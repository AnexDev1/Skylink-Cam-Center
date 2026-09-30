"use client"

import { useMemo, useState } from "react"
import { useAlertStream } from "@/components/alerts/use-alert-stream"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import type { EventDto } from "@/server/events/types"

const typeStyle = {
  MOTION: "bg-sl-warning/15 text-sl-warning",
  TAMPER: "bg-sl-danger/15 text-sl-danger",
  OFFLINE: "bg-sl-danger/15 text-sl-danger",
  ONLINE: "bg-sl-success/15 text-sl-success",
} as const

export function AlertsFeed({
  cameras,
  initialEvents,
  canAcknowledge,
}: {
  cameras: { id: string; name: string }[]
  initialEvents: EventDto[]
  canAcknowledge: boolean
}) {
  const [events, setEvents] = useState(initialEvents)
  const [cameraId, setCameraId] = useState("all")
  const [type, setType] = useState("all")
  const [pendingId, setPendingId] = useState<string | null>(null)

  useAlertStream({
    onSnapshot: () => {},
    onAlert: (event) => {
      setEvents((current) =>
        current.some((item) => item.id === event.id) ? current : [event, ...current],
      )
    },
    onAcknowledged: (id) => {
      setEvents((current) =>
        current.map((event) => (event.id === id ? { ...event, acknowledged: true } : event)),
      )
    },
  })

  const visible = useMemo(
    () =>
      events.filter(
        (event) =>
          (cameraId === "all" || event.cameraId === cameraId) &&
          (type === "all" || event.type === type),
      ),
    [events, cameraId, type],
  )

  async function acknowledge(id: string) {
    setPendingId(id)
    const response = await fetch(`/api/events/${id}/acknowledge`, { method: "POST" })
    if (response.ok) {
      setEvents((current) =>
        current.map((event) => (event.id === id ? { ...event, acknowledged: true } : event)),
      )
    }
    setPendingId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts"
        description="Motion, tamper, and connectivity changes appear here as they happen."
      />
      <div className="flex flex-wrap gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-sl-text-muted">Camera</span>
          <select
            className="h-8 rounded-lg border border-border bg-sl-surface px-2"
            value={cameraId}
            onChange={(event) => setCameraId(event.target.value)}
          >
            <option value="all">All cameras</option>
            {cameras.map((camera) => (
              <option key={camera.id} value={camera.id}>
                {camera.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-sl-text-muted">Type</span>
          <select
            className="h-8 rounded-lg border border-border bg-sl-surface px-2"
            value={type}
            onChange={(event) => setType(event.target.value)}
          >
            <option value="all">All types</option>
            <option value="MOTION">Motion</option>
            <option value="TAMPER">Tamper</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
          </select>
        </label>
      </div>
      <section className="overflow-hidden rounded-xl border border-border bg-sl-surface">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-sm text-sl-text-muted">No alerts match this filter.</p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${typeStyle[event.type]}`}>
                  {event.type === "MOTION"
                    ? "Motion"
                    : event.type === "TAMPER"
                      ? "Tamper"
                      : event.type === "ONLINE"
                        ? "Online"
                        : "Offline"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{event.cameraName}</p>
                  <p className="text-sm text-sl-text-muted">{event.message}</p>
                </div>
                <time className="text-xs text-sl-text-muted" dateTime={event.createdAt}>
                  {new Date(event.createdAt).toLocaleString()}
                </time>
                {event.acknowledged ? (
                  <span className="text-xs font-semibold text-sl-text-muted">Acknowledged</span>
                ) : canAcknowledge ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendingId === event.id}
                    onClick={() => void acknowledge(event.id)}
                  >
                    {pendingId === event.id ? "Saving…" : "Acknowledge"}
                  </Button>
                ) : (
                  <span className="text-xs font-semibold text-sl-text-muted">Open</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
