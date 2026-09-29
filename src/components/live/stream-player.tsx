"use client"

import Hls from "hls.js"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { CameraDto } from "@/server/cameras"

type Playback = { webrtc: string; hls: string }
type Mode = "idle" | "connecting" | "webrtc" | "hls" | "error"

type ApiError = { error?: string; code?: string }

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as ApiError | null
  return body?.code
    ? `${body.code}: ${body.error ?? "Request failed."}`
    : (body?.error ?? "Request failed.")
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

export function StreamPlayer({
  camera,
  autoStart = false,
}: {
  camera: CameraDto
  autoStart?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const sessionRef = useRef<string | null>(null)
  const [mode, setMode] = useState<Mode>(autoStart ? "connecting" : "idle")
  const [error, setError] = useState<string | null>(null)
  const [muted, setMuted] = useState(true)

  function closePlayer() {
    sessionRef.current = null
    peerRef.current?.close()
    peerRef.current = null
    hlsRef.current?.destroy()
    hlsRef.current = null
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.removeAttribute("src")
    }
  }

  async function playWebRtc(url: string) {
    const peer = new RTCPeerConnection()
    peerRef.current = peer
    peer.addTransceiver("video", { direction: "recvonly" })
    peer.addTransceiver("audio", { direction: "recvonly" })
    const trackReady = new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error("WebRTC timed out")), 8000)
      peer.ontrack = (event) => {
        window.clearTimeout(timeout)
        const video = videoRef.current
        if (!video) return
        video.srcObject = event.streams[0] ?? new MediaStream([event.track])
        void video.play().catch(() => undefined)
        resolve()
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
    sessionRef.current = response.headers.get("Location")
    await peer.setRemoteDescription({
      type: "answer",
      sdp: await response.text(),
    })
    await trackReady
  }

  function playHls(url: string) {
    const video = videoRef.current
    if (!video) throw new Error("Video element is not ready.")
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url
      void video.play().catch(() => undefined)
      return
    }
    if (!Hls.isSupported()) throw new Error("This browser cannot play HLS.")
    const hls = new Hls({ enableWorker: true })
    hlsRef.current = hls
    hls.loadSource(url)
    hls.attachMedia(video)
    return new Promise<void>((resolve, reject) => {
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        void video.play().catch(() => undefined)
        resolve()
      })
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        reject(new Error("HLS playback failed."))
      })
    })
  }

  async function start() {
    setMode("connecting")
    setError(null)
    closePlayer()
    const response = await fetch(`/api/cameras/${camera.id}/stream/start`, {
      method: "POST",
    })
    if (!response.ok) {
      setMode("error")
      setError(await readError(response))
      return false
    }
    const body = (await response.json()) as { playback: Playback }
    try {
      await playWebRtc(body.playback.webrtc)
      setMode("webrtc")
      return true
    } catch {
      peerRef.current?.close()
      peerRef.current = null
    }
    try {
      await playHls(body.playback.hls)
      setMode("hls")
      return true
    } catch (hlsError) {
      closePlayer()
      await fetch(`/api/cameras/${camera.id}/stream/stop`, { method: "POST" }).catch(
        () => undefined,
      )
      setMode("error")
      setError(
        hlsError instanceof Error
          ? "WebRTC and HLS both failed. The camera may still be connecting, or this browser cannot play the codec."
          : "The stream could not be played.",
      )
      return false
    }
  }

  async function stop() {
    closePlayer()
    setMode("idle")
    setError(null)
    await fetch(`/api/cameras/${camera.id}/stream/stop`, { method: "POST" }).catch(
      () => undefined,
    )
  }

  useEffect(() => {
    if (!autoStart) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      void start().then((playing) => {
        if (cancelled && playing) void stop()
      })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      closePlayer()
      void fetch(`/api/cameras/${camera.id}/stream/stop`, { method: "POST" }).catch(
        () => undefined,
      )
    }
    // The player owns this camera for the lifetime of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera.id, autoStart])

  const playing = mode === "webrtc" || mode === "hls"

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-sl-surface">
      <div className="relative aspect-video bg-[#0F172A]">
        <video
          ref={videoRef}
          className={`h-full w-full object-contain ${playing ? "block" : "hidden"}`}
          autoPlay
          playsInline
          muted={muted}
        />
        {mode === "connecting" ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            Connecting…
          </div>
        ) : null}
        {mode === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white">
            {error}
          </div>
        ) : null}
        {mode === "idle" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-white/80">Stream is stopped.</p>
            <Button size="sm" onClick={() => void start()}>
              Start
            </Button>
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{camera.name}</p>
          <p className="text-xs text-sl-text-muted">
            {camera.status === "ONLINE"
              ? "Online"
              : camera.status === "OFFLINE"
                ? "Offline"
                : "Unknown"}
            {playing ? ` · ${mode === "webrtc" ? "WebRTC" : "HLS"}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {playing ? (
            <Button size="sm" variant="outline" onClick={() => setMuted((value) => !value)}>
              {muted ? "Unmute" : "Mute"}
            </Button>
          ) : null}
          {playing || mode === "connecting" ? (
            <Button size="sm" variant="outline" onClick={() => void stop()}>
              Stop Stream
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
