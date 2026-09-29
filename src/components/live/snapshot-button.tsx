"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

export function SnapshotButton({
  cameraId,
  cameraName,
}: {
  cameraId: string
  cameraName: string
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageUrl, setImageUrl] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl)
    }
  }, [imageUrl])

  async function takeSnapshot() {
    setPending(true)
    setError(null)
    const response = await fetch(`/api/cameras/${cameraId}/snapshot`, { method: "POST" })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
        code?: string
      } | null
      setError(
        body?.code
          ? `${body.code}: ${body.error ?? "Snapshot failed."}`
          : (body?.error ?? "Snapshot failed."),
      )
      setPending(false)
      return
    }
    const blob = await response.blob()
    const nextUrl = URL.createObjectURL(blob)
    setImageUrl((current) => {
      if (current) URL.revokeObjectURL(current)
      return nextUrl
    })
    setPending(false)
  }

  return (
    <section className="rounded-xl border border-border bg-sl-surface p-4">
      <h2 className="text-sm font-semibold">Snapshot</h2>
      <p className="mt-1 text-xs text-sl-text-muted">
        The still image is fetched by the server, so camera credentials stay off this page.
      </p>
      <Button className="mt-3" size="sm" disabled={pending} onClick={() => void takeSnapshot()}>
        {pending ? "Taking snapshot…" : "Take Snapshot"}
      </Button>
      {error ? (
        <p className="mt-3 text-xs text-sl-danger" role="alert">
          {error}
        </p>
      ) : null}
      {imageUrl ? (
        <div className="mt-3 flex flex-col gap-2">
          {/* blob URL from the authenticated snapshot response */}
          <img
            src={imageUrl}
            alt={`Snapshot from ${cameraName}`}
            className="aspect-video w-full rounded-lg bg-[#0F172A] object-contain"
          />
          <a
            href={imageUrl}
            download={`${cameraName.replace(/\s+/g, "-").toLowerCase()}-snapshot.jpg`}
            className="text-xs font-semibold text-sl-primary"
          >
            Download snapshot
          </a>
        </div>
      ) : null}
    </section>
  )
}
