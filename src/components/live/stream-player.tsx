"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { startStream, stopStream, useStreamSession } from "@/components/live/stream-session"
import type { CameraDto } from "@/server/cameras"

export function StreamPlayer({ camera }: { camera: CameraDto }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const session = useStreamSession(camera.id)
  const [muted, setMuted] = useState(true)
  const playing = session.mode === "webrtc" || session.mode === "hls"

  useEffect(() => {
    const video = videoRef.current
    if (!video || !session.stream) return
    if (video.srcObject !== session.stream) video.srcObject = session.stream
    void video.play().catch(() => undefined)
  }, [session.stream])

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
        {session.mode === "connecting" ? (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            Connecting…
          </div>
        ) : null}
        {session.mode === "error" ? (
          <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-sm text-white">
            {session.error}
          </div>
        ) : null}
        {session.mode === "idle" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-white/80">Stream is stopped.</p>
            <Button size="sm" onClick={() => startStream(camera.id)}>
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
            {playing ? ` · ${session.mode === "webrtc" ? "WebRTC" : "HLS"}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {playing ? (
            <Button size="sm" variant="outline" onClick={() => setMuted((value) => !value)}>
              {muted ? "Unmute" : "Mute"}
            </Button>
          ) : null}
          {playing || session.mode === "connecting" ? (
            <Button size="sm" variant="outline" onClick={() => stopStream(camera.id)}>
              Stop Stream
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
