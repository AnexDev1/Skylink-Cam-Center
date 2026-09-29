"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import type { PtzDirection } from "@/server/onvif/ptz"

const pad: Array<{ direction: PtzDirection; label: string } | null> = [
  { direction: "up-left", label: "Up left" },
  { direction: "up", label: "Up" },
  { direction: "up-right", label: "Up right" },
  { direction: "left", label: "Left" },
  null,
  { direction: "right", label: "Right" },
  { direction: "down-left", label: "Down left" },
  { direction: "down", label: "Down" },
  { direction: "down-right", label: "Down right" },
]

async function readError(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    error?: string
    code?: string
  } | null
  return body?.code
    ? `${body.code}: ${body.error ?? "PTZ command failed."}`
    : (body?.error ?? "PTZ command failed.")
}

export function PtzControls({ cameraId }: { cameraId: string }) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const repeat = useRef<number | null>(null)

  async function send(action: "move" | "stop" | "home", direction?: PtzDirection) {
    const response = await fetch(`/api/cameras/${cameraId}/ptz`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, direction }),
    })
    if (!response.ok) setError(await readError(response))
    else setError(null)
  }

  function hold(direction: PtzDirection) {
    if (repeat.current !== null) window.clearInterval(repeat.current)
    void send("move", direction)
    repeat.current = window.setInterval(() => void send("move", direction), 400)
    setBusy(direction)
  }

  function release() {
    if (repeat.current !== null) window.clearInterval(repeat.current)
    repeat.current = null
    setBusy(null)
    void send("stop")
  }

  return (
    <section className="rounded-xl border border-border bg-sl-surface p-4">
      <h2 className="text-sm font-semibold">PTZ</h2>
      <p className="mt-1 text-xs text-sl-text-muted">Hold a direction to move. Release to stop.</p>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {pad.map((cell, index) =>
          cell ? (
            <Button
              key={cell.direction}
              type="button"
              size="sm"
              variant="outline"
              aria-label={cell.label}
              className={busy === cell.direction ? "bg-sl-primary text-white" : undefined}
              onPointerDown={(event) => {
                event.preventDefault()
                event.currentTarget.setPointerCapture(event.pointerId)
                hold(cell.direction)
              }}
              onPointerUp={release}
              onPointerCancel={release}
            >
              {cell.label}
            </Button>
          ) : (
            <Button
              key={`home-${index}`}
              type="button"
              size="sm"
              onClick={() => void send("home")}
            >
              Home
            </Button>
          ),
        )}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        {(["zoom-in", "zoom-out"] as const).map((direction) => (
          <Button
            key={direction}
            type="button"
            size="sm"
            variant="outline"
            onPointerDown={(event) => {
              event.preventDefault()
              event.currentTarget.setPointerCapture(event.pointerId)
              hold(direction)
            }}
            onPointerUp={release}
            onPointerCancel={release}
          >
            {direction === "zoom-in" ? "Zoom in" : "Zoom out"}
          </Button>
        ))}
      </div>
      {error ? (
        <p className="mt-3 text-xs text-sl-danger" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
