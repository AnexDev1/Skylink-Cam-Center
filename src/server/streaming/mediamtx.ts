import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { StreamError } from "@/server/streaming/errors"

const transcoders = new Map<string, ChildProcess>()

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

async function waitForTracks(cameraId: string) {
  const deadline = Date.now() + 12000
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

function startTranscode(cameraId: string, playbackId: string) {
  const running = transcoders.get(playbackId)
  if (running && running.exitCode === null) return
  const child = spawn(
    ffmpegBin(),
    [
      "-nostdin",
      "-hide_banner",
      "-loglevel",
      "error",
      "-rtsp_transport",
      "tcp",
      "-i",
      `rtsp://127.0.0.1:8554/${cameraId}`,
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-pix_fmt",
      "yuv420p",
      "-an",
      "-f",
      "rtsp",
      "-rtsp_transport",
      "tcp",
      `rtsp://127.0.0.1:8554/${playbackId}`,
    ],
    { stdio: "ignore" },
  )
  transcoders.set(playbackId, child)
  child.on("exit", () => {
    if (transcoders.get(playbackId) === child) transcoders.delete(playbackId)
  })
}

function stopTranscode(playbackId: string) {
  const child = transcoders.get(playbackId)
  transcoders.delete(playbackId)
  if (child && child.exitCode === null) child.kill("SIGTERM")
}

export async function registerStream(cameraId: string, rtspUrl: string) {
  if (!rtspUrl.startsWith("rtsp://") && !rtspUrl.startsWith("rtsps://")) {
    throw new StreamError(
      "STREAM_NO_SOURCE",
      "The camera did not return an RTSP stream address.",
    )
  }

  await upsertPath(
    cameraId,
    JSON.stringify({
      source: rtspUrl,
      sourceOnDemand: false,
      rtspTransport: "tcp",
    }),
  )

  const tracks = await waitForTracks(cameraId)
  const hevc = tracks.some((track) => /265|hevc/i.test(track))
  if (!hevc) return getPlaybackUrls(cameraId)

  const playbackId = `${cameraId}-h264`
  stopTranscode(playbackId)
  await deletePath(playbackId)
  await upsertPath(playbackId, JSON.stringify({ source: "publisher" }))
  startTranscode(cameraId, playbackId)
  const converted = await waitForTracks(playbackId)
  if (!converted.some((track) => /264|avc/i.test(track))) {
    stopTranscode(playbackId)
    throw new StreamError(
      "STREAM_REJECTED",
      "The recorder video is H.265. Converting it for the browser did not produce a picture.",
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
