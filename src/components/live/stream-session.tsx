"use client"

import Hls from "hls.js"
import { useEffect, useSyncExternalStore } from "react"
import type { CameraDto } from "@/server/cameras"

type Playback = { webrtc: string; hls: string }
type Mode = "idle" | "connecting" | "webrtc" | "hls" | "error"

export type StreamSnapshot = {
  mode: Mode
  error: string | null
  stream: MediaStream | null
}

type Runtime = {
  snapshot: StreamSnapshot
  peer: RTCPeerConnection | null
  hls: Hls | null
  hidden: HTMLVideoElement | null
  starting: boolean
  stopped: boolean
  muted: boolean
  stall: number | null
}

const CONNECTING: StreamSnapshot = { mode: "connecting", error: null, stream: null }
const IDLE: StreamSnapshot = { mode: "idle", error: null, stream: null }

const runtimes = new Map<string, Runtime>()
const listeners = new Set<() => void>()
let releaseTimer: number | null = null
let knownCameras: CameraDto[] = []

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function setSnapshot(runtime: Runtime, snapshot: StreamSnapshot) {
  runtime.snapshot = snapshot
  emit()
}

export function useStreamSession(cameraId: string) {
  return useSyncExternalStore(
    subscribe,
    () => {
      const runtime = runtimes.get(cameraId)
      if (!runtime) return CONNECTING
      return runtime.stopped ? IDLE : runtime.snapshot
    },
    () => CONNECTING,
  )
}

function waitForIce(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === "complete") return Promise.resolve()
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(() => {
      peer.removeEventListener("icegatheringstatechange", onChange)
      resolve()
    }, 2500)
    function onChange() {
      if (peer.iceGatheringState !== "complete") return
      window.clearTimeout(timeout)
      peer.removeEventListener("icegatheringstatechange", onChange)
      resolve()
    }
    peer.addEventListener("icegatheringstatechange", onChange)
  })
}

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null
  return body?.code
    ? `${body.code}: ${body.error ?? "Request failed."}`
    : (body?.error ?? "Request failed.")
}

function parkVideo(video: HTMLVideoElement) {
  video.className = ""
  video.style.cssText = "position:fixed;width:160px;height:90px;opacity:0;pointer-events:none"
  video.setAttribute("aria-hidden", "true")
  document.body.appendChild(video)
}

function holdStream(runtime: Runtime, stream: MediaStream) {
  const video = document.createElement("video")
  video.muted = runtime.muted
  video.autoplay = true
  video.playsInline = true
  video.disablePictureInPicture = true
  video.srcObject = stream
  parkVideo(video)
  runtime.hidden = video
  void video.play().catch(() => undefined)
}

export function claimVideo(cameraId: string, slot: HTMLElement) {
  const runtime = runtimes.get(cameraId)
  const video = runtime?.hidden
  if (!video) return () => undefined
  video.className = "h-full w-full object-contain"
  video.style.cssText = ""
  video.removeAttribute("aria-hidden")
  video.muted = runtime.muted
  slot.appendChild(video)
  void video.play().catch(() => undefined)
  return () => {
    if (runtime.hidden !== video) return
    parkVideo(video)
  }
}

export function setStreamMuted(cameraId: string, muted: boolean) {
  const runtime = runtimes.get(cameraId)
  if (!runtime) return
  runtime.muted = muted
  if (runtime.hidden) runtime.hidden.muted = muted
}

function closeRuntime(runtime: Runtime) {
  if (runtime.stall !== null) window.clearInterval(runtime.stall)
  runtime.stall = null
  runtime.peer?.close()
  runtime.peer = null
  runtime.hls?.destroy()
  runtime.hls = null
  runtime.hidden?.remove()
  runtime.hidden = null
}

async function playWebRtc(runtime: Runtime, url: string) {
  const peer = new RTCPeerConnection()
  runtime.peer = peer
  peer.addTransceiver("video", { direction: "recvonly" })
  const trackReady = new Promise<MediaStream>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("WebRTC timed out")), 20000)
    peer.ontrack = (event) => {
      window.clearTimeout(timeout)
      const track = event.track
      resolve(event.streams[0] ?? new MediaStream([track]))
    }
  })
  const offer = await peer.createOffer()
  await peer.setLocalDescription(offer)
  await waitForIce(peer)
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/sdp" },
    body: peer.localDescription?.sdp ?? "",
  })
  if (!response.ok) throw new Error(`WebRTC handshake failed (${response.status})`)
  await peer.setRemoteDescription({ type: "answer", sdp: await response.text() })
  return trackReady
}

function playHls(runtime: Runtime, url: string) {
  const video = document.createElement("video")
  video.muted = runtime.muted
  video.autoplay = true
  video.playsInline = true
  video.disablePictureInPicture = true
  parkVideo(video)
  runtime.hidden = video

  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url
    return video.play().then(() => undefined)
  }
  if (!Hls.isSupported()) throw new Error("This browser cannot play HLS.")

  const hls = new Hls({
    enableWorker: true,
    lowLatencyMode: true,
    liveSyncDurationCount: 1,
    maxBufferLength: 2,
    backBufferLength: 0,
  })
  runtime.hls = hls
  hls.loadSource(url)
  hls.attachMedia(video)
  return new Promise<void>((resolve, reject) => {
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      void video.play().then(() => resolve()).catch(reject)
    })
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) return
      reject(new Error("HLS playback failed."))
    })
  })
}

function watchStall(camera: CameraDto, playback: Playback) {
  const runtime = runtimes.get(camera.id)
  if (!runtime) return
  if (runtime.stall !== null) window.clearInterval(runtime.stall)
  runtime.stall = window.setInterval(() => {
    if (runtime.stopped || runtime.starting || runtimes.get(camera.id) !== runtime) return
    const connection = runtime.peer?.connectionState
    const track = runtime.hidden?.srcObject instanceof MediaStream
      ? runtime.hidden.srcObject.getVideoTracks()[0]
      : undefined
    if (connection === "failed" || connection === "disconnected" || track?.readyState === "ended") {
      void reconnect(camera, playback)
    }
  }, 2000)
}

async function reconnect(camera: CameraDto, playback: Playback) {
  const runtime = runtimes.get(camera.id)
  if (!runtime || runtime.stopped || runtime.starting) return
  runtime.starting = true
  const previous = runtime.peer
  try {
    const stream = await playWebRtc(runtime, playback.webrtc)
    if (runtime.stopped || runtimes.get(camera.id) !== runtime) {
      runtime.peer?.close()
      return
    }
    previous?.close()
    if (runtime.hidden) {
      runtime.hidden.srcObject = stream
      void runtime.hidden.play().catch(() => undefined)
    } else {
      holdStream(runtime, stream)
    }
    runtime.starting = false
    setSnapshot(runtime, { mode: "webrtc", error: null, stream })
  } catch {
    if (runtimes.get(camera.id) !== runtime) return
    runtime.peer?.close()
    runtime.peer = previous
    runtime.starting = false
  }
}

async function ensure(camera: CameraDto, muted?: boolean) {
  const current = runtimes.get(camera.id)
  if (current?.stopped) return
  if (current && (current.starting || current.snapshot.mode === "webrtc" || current.snapshot.mode === "hls")) {
    return
  }

  const runtime: Runtime = {
    snapshot: CONNECTING,
    peer: null,
    hls: null,
    hidden: null,
    starting: true,
    stopped: false,
    muted: muted ?? current?.muted ?? true,
    stall: null,
  }
  runtimes.set(camera.id, runtime)
  emit()

  try {
    const response = await fetch(`/api/cameras/${camera.id}/stream/start`, { method: "POST" })
    if (runtime.stopped) return
    if (!response.ok) {
      runtime.starting = false
      setSnapshot(runtime, { mode: "error", error: await readError(response), stream: null })
      return
    }
    const body = (await response.json()) as { playback: Playback }
    try {
      const stream = await playWebRtc(runtime, body.playback.webrtc)
      if (runtime.stopped) return
      holdStream(runtime, stream)
      runtime.starting = false
      setSnapshot(runtime, { mode: "webrtc", error: null, stream })
      watchStall(camera, body.playback)
      return
    } catch {
      runtime.peer?.close()
      runtime.peer = null
    }
    try {
      await playHls(runtime, body.playback.hls)
      if (runtime.stopped) return
      runtime.starting = false
      setSnapshot(runtime, { mode: "hls", error: null, stream: null })
      watchStall(camera, body.playback)
    } catch {
      closeRuntime(runtime)
      runtime.starting = false
      setSnapshot(runtime, {
        mode: "error",
        error: "WebRTC and HLS both failed. The camera may still be connecting, or this browser cannot play the codec.",
        stream: null,
      })
    }
  } catch {
    if (runtime.stopped) return
    runtime.starting = false
    setSnapshot(runtime, { mode: "error", error: "The stream could not be started.", stream: null })
  }
}

async function stopOne(cameraId: string) {
  const runtime = runtimes.get(cameraId)
  if (!runtime) return
  runtime.stopped = true
  runtime.starting = false
  closeRuntime(runtime)
  setSnapshot(runtime, IDLE)
  await fetch(`/api/cameras/${cameraId}/stream/stop`, { method: "POST" }).catch(() => undefined)
}

function startOne(camera: CameraDto) {
  const runtime = runtimes.get(camera.id)
  if (runtime) {
    closeRuntime(runtime)
    runtimes.delete(camera.id)
  }
  void ensure(camera)
}

function stopAll() {
  for (const [id, runtime] of runtimes) {
    closeRuntime(runtime)
    void fetch(`/api/cameras/${id}/stream/stop`, { method: "POST" }).catch(() => undefined)
  }
  runtimes.clear()
  emit()
}

export function StreamSessionProvider({
  cameras,
  children,
}: {
  cameras: CameraDto[]
  children: React.ReactNode
}) {
  knownCameras = cameras
  const cameraKey = cameras.map((camera) => camera.id).join(",")

  useEffect(() => {
    if (releaseTimer !== null) window.clearTimeout(releaseTimer)
    for (const camera of cameras) void ensure(camera)
    return () => {
      releaseTimer = window.setTimeout(() => {
        releaseTimer = null
        stopAll()
      }, 1500)
    }
    // The camera list is read for this key. A later list with the same ids keeps the sessions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraKey])

  return children
}

export function startStream(cameraId: string) {
  const camera = knownCameras.find((item) => item.id === cameraId)
  if (camera) startOne(camera)
}

export function stopStream(cameraId: string) {
  void stopOne(cameraId)
}
