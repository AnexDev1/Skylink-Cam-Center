"use client"

import Link from "next/link"
import { useState } from "react"
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
  const [density, setDensity] = useState<"2" | "3">("2")
  const visible = cameras.filter((camera) => camera.siteId === siteId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Live View"
          description="Start only the cameras you want to watch. Each stream is pulled when you press Start and released when you stop it."
        />
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-sl-text-muted">Site</span>
            <select
              className="h-8 rounded-lg border border-border bg-sl-surface px-2"
              value={siteId}
              onChange={(event) => setSiteId(event.target.value)}
            >
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={density === "2" ? "default" : "outline"}
              onClick={() => setDensity("2")}
            >
              2×2
            </Button>
            <Button
              size="sm"
              variant={density === "3" ? "default" : "outline"}
              onClick={() => setDensity("3")}
            >
              3×3
            </Button>
          </div>
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
          className={
            density === "2"
              ? "grid grid-cols-1 gap-4 md:grid-cols-2"
              : "grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {visible.map((camera) => (
            <div key={camera.id} className="flex flex-col gap-2">
              <StreamPlayer camera={camera} />
              <Link
                href={`/dashboard/live/${camera.id}`}
                className="px-1 text-xs font-semibold text-sl-primary"
              >
                Open {camera.name}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
