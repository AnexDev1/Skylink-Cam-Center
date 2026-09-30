import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { StreamError } from "@/server/streaming/errors"

type TranscodeJob = {
  sourceUrl: string
  playbackId: string
  child: ChildProcess | null
  closed: boolean
}

const transcoders = new Map<string, TranscodeJob>()
const starting = new Map<string, Promise<PlaybackUrls>>()

export type PlaybackUrls = {
  webrtc: string
  hls: string
}

function apiBase() {
  return (process.env.MEDIAMTX_API_URL ?? "http://127.0.0.1:9997").replace(/\/$/, "")
}

function publicBase(name: "MEDIAMTX_HLS_BASE_URL" | "MEDIAMTX_WEBRTC_BASE_URL", fallback: string) {
  return (process.env[name] ?? fallback).replace(/\/$/, "")
}

function pathName(cameraId: string) {
  return encodeURIComponent(cameraId)
}

async function control(path: string, init: RequestInit) {
  try {
    return await fetch(`${apiBase()}${path}`, {
      ...init,
      signal: AbortSignal.timeout(8000),
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    })
  } catch {
    throw new StreamError(
      "STREAM_GATEWAY_UNAVAILABLE",
      "MediaMTX is not reachable. Start the streaming service and try again.",
    )
  }
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  return body?.error || `MediaMTX returned ${response.status}.`
}

export function getPlaybackUrls(cameraId: string): PlaybackUrls {
  const name = pathName(cameraId)
  return {
    webrtc: `${publicBase("MEDIAMTX_WEBRTC_BASE_URL", "http://127.0.0.1:8889")}/${name}/whep`,
    hls: `${publicBase("MEDIAMTX_HLS_BASE_URL", "http://127.0.0.1:8888")}/${name}/index.m3u8`,
  }
}

function ffmpegBin() {
  const ffmpeg = path.join(process.cwd(), "node_modules", "ffmpeg-static", "ffmpeg")
  if (!existsSync(ffmpeg)) {
    throw new StreamError(
      "STREAM_REJECTED",
      "This recorder sends H.265, and the browser cannot play it. The H.264 converter is not available.",
    )
  }
  return ffmpeg
}

async function upsertPath(name: string, body: string) {
  const created = await control(`/v3/config/paths/add/${pathName(name)}`, {
    method: "POST",
    body,
  })
  if (created.ok) return
  const message = await readError(created)
  if (created.status !== 400 || !/exist/i.test(message)) {
    throw new StreamError("STREAM_REJECTED", message)
  }
  const patched = await control(`/v3/config/paths/patch/${pathName(name)}`, {
    method: "PATCH",
    body,
  })
  if (!patched.ok) {
    throw new StreamError("STREAM_REJECTED", await readError(patched))
  }
}

async function currentTracks(cameraId: string) {
  const response = await control("/v3/paths/list", { method: "GET" })
  if (!response.ok) return []
  const body = (await response.json()) as {
    items?: { name?: string; ready?: boolean; tracks?: string[] }[]
  }
  const item = body.items?.find((entry) => entry.name === cameraId)
  return item?.ready && item.tracks?.length ? item.tracks : []
}

async function waitForTracks(cameraId: string) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    const response = await control("/v3/paths/list", { method: "GET" })
    if (response.ok) {
      const body = (await response.json()) as {
        items?: { name?: string; ready?: boolean; tracks?: string[] }[]
      }
      const item = body.items?.find((entry) => entry.name === cameraId)
      if (item?.ready && item.tracks?.length) return item.tracks
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  return []
}

function signalPublishers(playbackId: string) {
  let entries: string[]
  try {
    entries = readdirSync("/proc")
  } catch {
    return
  }
  for (const entry of entries) {
    if (!/^\d+$/.test(entry)) continue
    const pid = Number(entry)
    if (pid === process.pid) continue
    try {
      const text = readFileSync(`/proc/${pid}/cmdline`).toString("utf8")
      if (!text.includes("ffmpeg") || !text.includes(`/${playbackId}`)) continue
      process.kill(pid, "SIGTERM")
    } catch {
      // The process already exited, or this user cannot signal it.
    }
  }
}

function spawnTranscode(job: TranscodeJob) {
  signalPublishers(job.playbackId)
  const child = spawn(
    ffmpegBin(),
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "genpts+discardcorrupt",
      "-rtsp_transport",
      "tcp",
      "-i",
      job.sourceUrl,
      "-vf",
      "fps=15,scale=in_range=pc:out_range=tv,format=yuv420p",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-profile:v",
      "baseline",
      "-r",
      "15",
      "-g",
      "15",
      "-keyint_min",
      "15",
      "-sc_threshold",
      "0",
      "-bf",
      "0",
      "-refs",
      "1",
      "-b:v",
      "1800k",
      "-maxrate",
      "2200k",
      "-bufsize",
      "1800k",
      "-x264-params",
      "bframes=0:rc-lookahead=0:sync-lookahead=0:sliced-threads=1",
      "-fps_mode",
      "cfr",
      "-an",
      "-muxdelay",
      "0",
      "-muxpreload",
      "0",
      "-max_muxing_queue_size",
      "16",
      "-f",
      "rtsp",
      "-rtsp_transport",
      "tcp",
      `rtsp://127.0.0.1:8554/${job.playbackId}`,
    ],
    { stdio: "ignore" },
  )
  job.child = child
  const started = Date.now()
  child.on("exit", () => {
    if (job.closed || transcoders.get(job.playbackId) !== job) return
    // A fast exit means the publish path is not ready. Another start request will try again.
    if (Date.now() - started < 2500) {
      job.closed = true
      transcoders.delete(job.playbackId)
      return
    }
    setTimeout(() => {
      if (job.closed || transcoders.get(job.playbackId) !== job) return
      spawnTranscode(job)
    }, 1500)
  })
}

function startTranscode(playbackId: string, sourceUrl: string) {
  const running = transcoders.get(playbackId)
  if (
    running &&
    !running.closed &&
    running.sourceUrl === sourceUrl &&
    running.child &&
    running.child.exitCode === null
  ) {
    return
  }
  stopTranscode(playbackId)
  const job: TranscodeJob = { sourceUrl, playbackId, child: null, closed: false }
  transcoders.set(playbackId, job)
  spawnTranscode(job)
}

function stopTranscode(playbackId: string) {
  const job = transcoders.get(playbackId)
  if (job) {
    job.closed = true
    transcoders.delete(playbackId)
    if (job.child && job.child.exitCode === null) job.child.kill("SIGTERM")
  }
  signalPublishers(playbackId)
}

export function registerStream(cameraId: string, rtspUrl: string) {
  const current = starting.get(cameraId)
  if (current) return current
  const job = openStream(cameraId, rtspUrl).finally(() => {
    if (starting.get(cameraId) === job) starting.delete(cameraId)
  })
  starting.set(cameraId, job)
  return job
}

async function openStream(cameraId: string, rtspUrl: string) {
  if (!rtspUrl.startsWith("rtsp://") && !rtspUrl.startsWith("rtsps://")) {
    throw new StreamError(
      "STREAM_NO_SOURCE",
      "The camera did not return an RTSP stream address.",
    )
  }

  const playbackId = `${cameraId}-h264`
  const running = transcoders.get(playbackId)
  if (running && !running.closed && running.child && running.child.exitCode === null) {
    const live = await currentTracks(playbackId)
    if (live.some((track) => /264|avc/i.test(track))) return getPlaybackUrls(playbackId)
  }

  // The recorder clock drifts. A steady H.264 publish keeps the browser from freezing.
  await deletePath(cameraId).catch(() => undefined)
  stopTranscode(playbackId)
  await deletePath(playbackId).catch(() => undefined)
  await upsertPath(playbackId, JSON.stringify({ source: "publisher" }))
  startTranscode(playbackId, rtspUrl)
  const converted = await waitForTracks(playbackId)
  if (!converted.some((track) => /264|avc/i.test(track))) {
    stopTranscode(playbackId)
    throw new StreamError(
      "STREAM_REJECTED",
      "The recorder video could not be prepared for the browser.",
    )
  }
  return getPlaybackUrls(playbackId)
}

async function deletePath(name: string) {
  const response = await control(`/v3/config/paths/delete/${pathName(name)}`, {
    method: "DELETE",
  })
  if (response.ok || response.status === 404) return
  throw new StreamError("STREAM_REJECTED", await readError(response))
}

export async function unregisterStream(cameraId: string) {
  stopTranscode(`${cameraId}-h264`)
  await deletePath(`${cameraId}-h264`)
  await deletePath(cameraId)
}
