import { StreamError } from "@/server/streaming/errors"

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

export async function registerStream(cameraId: string, rtspUrl: string) {
  if (!rtspUrl.startsWith("rtsp://") && !rtspUrl.startsWith("rtsps://")) {
    throw new StreamError(
      "STREAM_NO_SOURCE",
      "The camera did not return an RTSP stream address.",
    )
  }

  const body = JSON.stringify({
    source: rtspUrl,
    sourceOnDemand: false,
    rtspTransport: "tcp",
  })
  const name = pathName(cameraId)
  const created = await control(`/v3/config/paths/add/${name}`, {
    method: "POST",
    body,
  })

  if (created.ok) return getPlaybackUrls(cameraId)

  const message = await readError(created)
  if (created.status !== 400 || !/exist/i.test(message)) {
    throw new StreamError("STREAM_REJECTED", message)
  }

  const patched = await control(`/v3/config/paths/patch/${name}`, {
    method: "PATCH",
    body,
  })
  if (!patched.ok) {
    throw new StreamError("STREAM_REJECTED", await readError(patched))
  }

  return getPlaybackUrls(cameraId)
}

export async function unregisterStream(cameraId: string) {
  const response = await control(`/v3/config/paths/delete/${pathName(cameraId)}`, {
    method: "DELETE",
  })
  if (response.ok || response.status === 404) return
  throw new StreamError("STREAM_REJECTED", await readError(response))
}
