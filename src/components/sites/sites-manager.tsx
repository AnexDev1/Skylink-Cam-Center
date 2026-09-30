"use client"

import { useRef, useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type CameraOption = { id: string; name: string }
type SiteRecord = {
  id: string
  name: string
  address: string
  cameras: CameraOption[]
}

const fieldClass = "h-8 rounded-lg border border-border bg-sl-surface px-2 text-sm"

export function SitesManager({ initialSites }: { initialSites: SiteRecord[] }) {
  const [sites, setSites] = useState(initialSites)
  const [name, setName] = useState("")
  const [address, setAddress] = useState("")
  const [editing, setEditing] = useState<SiteRecord | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [removing, setRemoving] = useState<SiteRecord | null>(null)

  async function readError(response: Response) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null
    return body?.code ? `${body.code}: ${body.error ?? "Request failed."}` : (body?.error ?? "Request failed.")
  }

  async function createSite(event: React.FormEvent) {
    event.preventDefault()
    setPending("create")
    setError(null)
    const response = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, address }),
    })
    if (!response.ok) {
      setError(await readError(response))
      setPending(null)
      return
    }
    const body = (await response.json()) as { site: SiteRecord }
    setSites((current) => [...current, body.site].sort((a, b) => a.name.localeCompare(b.name)))
    setName("")
    setAddress("")
    setPending(null)
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    setPending(editing.id)
    setError(null)
    const response = await fetch(`/api/sites/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editing.name, address: editing.address }),
    })
    if (!response.ok) {
      setError(await readError(response))
      setPending(null)
      return
    }
    setSites((current) =>
      current
        .map((site) => (site.id === editing.id ? { ...site, name: editing.name, address: editing.address } : site))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    setEditing(null)
    setPending(null)
  }

  async function removeSite() {
    if (!removing) return
    setPending(removing.id)
    setError(null)
    const response = await fetch(`/api/sites/${removing.id}`, { method: "DELETE" })
    if (!response.ok && response.status !== 204) {
      setError(await readError(response))
      setPending(null)
      return
    }
    setSites((current) => current.filter((site) => site.id !== removing.id))
    dialogRef.current?.close()
    setRemoving(null)
    setPending(null)
  }

  async function moveCamera(cameraId: string, siteId: string) {
    setPending(cameraId)
    setError(null)
    const response = await fetch(`/api/cameras/${cameraId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ siteId }),
    })
    if (!response.ok) {
      setError(await readError(response))
      setPending(null)
      return
    }
    setSites((current) => {
      let moved: CameraOption | undefined
      const without = current.map((site) => {
        const camera = site.cameras.find((item) => item.id === cameraId)
        if (!camera) return site
        moved = camera
        return { ...site, cameras: site.cameras.filter((item) => item.id !== cameraId) }
      })
      if (!moved) return current
      return without.map((site) =>
        site.id === siteId ? { ...site, cameras: [...site.cameras, moved!].sort((a, b) => a.name.localeCompare(b.name)) } : site,
      )
    })
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sites"
        description="Sites belong to your organization. Cameras are assigned to one site."
      />
      {error ? (
        <p className="rounded-lg border border-sl-danger/30 bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={(event) => void createSite(event)} className="grid gap-3 rounded-xl border border-border bg-sl-surface p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-base">New site</h2>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-name">Name</Label>
          <Input id="site-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="site-address">Address</Label>
          <Input id="site-address" value={address} onChange={(event) => setAddress(event.target.value)} />
        </div>
        <div>
          <Button type="submit" disabled={pending === "create"}>
            {pending === "create" ? "Saving…" : "Create site"}
          </Button>
        </div>
      </form>

      {editing ? (
        <form onSubmit={(event) => void saveEdit(event)} className="grid gap-3 rounded-xl border border-border bg-sl-surface p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base">Edit {editing.name}</h2>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-site-name">Name</Label>
            <Input id="edit-site-name" value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-site-address">Address</Label>
            <Input id="edit-site-address" value={editing.address} onChange={(event) => setEditing({ ...editing, address: event.target.value })} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending === editing.id}>Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      <section className="flex flex-col gap-4">
        {sites.length === 0 ? (
          <p className="rounded-xl border border-border bg-sl-surface px-5 py-8 text-sm text-sl-text-muted">
            No sites yet.
          </p>
        ) : (
          sites.map((site) => (
            <article key={site.id} className="rounded-xl border border-border bg-sl-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div>
                  <h2 className="text-base">{site.name}</h2>
                  <p className="mt-1 text-sm text-sl-text-muted">{site.address || "No address"}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(site)}>Edit</Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setRemoving(site)
                      dialogRef.current?.showModal()
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {site.cameras.length === 0 ? (
                <p className="px-5 py-4 text-sm text-sl-text-muted">No cameras assigned.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {site.cameras.map((camera) => (
                    <li key={camera.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm font-semibold">{camera.name}</span>
                      <label className="flex items-center gap-2 text-sm text-sl-text-muted">
                        Site
                        <select
                          className={fieldClass}
                          value={site.id}
                          disabled={pending === camera.id}
                          onChange={(event) => void moveCamera(camera.id, event.target.value)}
                        >
                          {sites.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          ))
        )}
      </section>

      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-sl-surface p-5 text-sl-text backdrop:bg-black/40"
      >
        <h2 className="text-base">Delete {removing?.name}?</h2>
        <p className="mt-2 text-sm text-sl-text-muted">
          Cameras assigned to this site are deleted with it. The cameras themselves stay on the network.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending === removing?.id} onClick={() => void removeSite()}>
            {pending === removing?.id ? "Deleting…" : "Delete site"}
          </Button>
        </div>
      </dialog>
    </div>
  )
}
