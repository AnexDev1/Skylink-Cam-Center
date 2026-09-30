"use client"

import { useRouter } from "next/navigation"

export function SiteSelector({
  sites,
  selectedId,
}: {
  sites: { id: string; name: string }[]
  selectedId: string
}) {
  const router = useRouter()

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-sl-text-muted">Site</span>
      <select
        className="h-8 rounded-lg border border-border bg-sl-surface px-2"
        value={selectedId}
        onChange={(event) => {
          const site = event.target.value
          router.push(site ? `/dashboard?site=${encodeURIComponent(site)}` : "/dashboard")
        }}
      >
        <option value="">All sites</option>
        {sites.map((site) => (
          <option key={site.id} value={site.id}>
            {site.name}
          </option>
        ))}
      </select>
    </label>
  )
}
