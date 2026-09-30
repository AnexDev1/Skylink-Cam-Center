"use client"

import Link from "next/link"
import { useRef, useState, type CSSProperties } from "react"
import { StreamPlayer } from "@/components/live/stream-player"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import type { CameraDto } from "@/server/cameras"

type SiteOption = { id: string; name: string }

export function LiveGrid({
  sites,
  cameras,
}: {
  sites: SiteOption[]
  cameras: CameraDto[]
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "")
  const [columns, setColumns] = useState(2)
  const [focusId, setFocusId] = useState<string | null>(null)
  const visible = cameras.filter((camera) => camera.siteId === siteId)
  const focused = visible.some((camera) => camera.id === focusId) ? focusId : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Live View"
          description="Cameras stay connected while you are signed in. Choose how many columns to show, or fill the view with one camera."
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sl-text-muted">Site</span>
            <select
              className="h-8 rounded-lg border border-border bg-sl-surface px-2"
              value={siteId}
              onChange={(event) => {
                setSiteId(event.target.value)
                setFocusId(null)
              }}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sl-text-muted">Columns</span>
            <input
              type="number"
              min={1}
              max={8}
              value={columns}
              aria-label="Grid columns"
              disabled={focused !== null}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (Number.isInteger(next)) setColumns(Math.min(8, Math.max(1, next)))
              }}
              className="h-8 w-20 rounded-lg border border-border bg-sl-surface px-2"
            />
          </label>
        </div>
      </div>

      {visible.length === 0 ? (
        <section className="rounded-xl border border-border bg-sl-surface px-5 py-10 text-sm text-sl-text-muted">
          No cameras saved for this site.{" "}
          <Link href="/dashboard/cameras" className="font-semibold text-sl-primary">
            Add a camera
          </Link>{" "}
          before starting a live view.
        </section>
      ) : (
        <div
          className="grid grid-cols-1 gap-4 md:[grid-template-columns:repeat(var(--live-cols),minmax(0,1fr))]"
          style={{ "--live-cols": focused ? 1 : columns } as CSSProperties}
        >
          {visible.map((camera) => (
            <LiveTile
              key={camera.id}
              camera={camera}
              hidden={focused !== null && focused !== camera.id}
              expanded={focused === camera.id}
              onFill={() => setFocusId(camera.id)}
              onGrid={() => setFocusId(null)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function LiveTile({
  camera,
  hidden,
  expanded,
  onFill,
  onGrid,
}: {
  camera: CameraDto
  hidden: boolean
  expanded: boolean
  onFill: () => void
  onGrid: () => void
}) {
  const frameRef = useRef<HTMLDivElement>(null)

  async function toggleFullscreen() {
    const frame = frameRef.current
    if (!frame) return
    if (document.fullscreenElement === frame) {
      await document.exitFullscreen()
      return
    }
    await frame.requestFullscreen()
  }

  return (
    <div ref={frameRef} className={hidden ? "hidden" : "flex flex-col gap-2 bg-background"}>
      <StreamPlayer camera={camera} />
      <div className="flex flex-wrap gap-2 px-1">
        {expanded ? (
          <Button size="sm" variant="outline" onClick={onGrid}>
            Show grid
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onFill}>
            Fill view
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => void toggleFullscreen()}>
          Full screen
        </Button>
      </div>
    </div>
  )
}
