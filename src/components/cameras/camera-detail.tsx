"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CameraDto } from "@/server/cameras"

type StatusLog = {
  id: string
  status: CameraDto["status"]
  createdAt: string
}

const statusLabel = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  UNKNOWN: "Unknown",
} as const

const statusStyle = {
  ONLINE: "bg-sl-success/15 text-sl-success",
  OFFLINE: "bg-sl-danger/15 text-sl-danger",
  UNKNOWN: "bg-muted text-sl-text-muted",
} as const

export function CameraDetail({
  camera,
  logs,
}: {
  camera: CameraDto
  logs: StatusLog[]
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState(camera.name)
  const [username, setUsername] = useState(camera.username)
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function save(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    const response = await fetch(`/api/cameras/${camera.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, username, password }),
    })
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string
        code?: string
      } | null
      setError(
        body?.code
          ? `${body.code}: ${body.error ?? "Save failed."}`
          : (body?.error ?? "Save failed."),
      )
      setSaving(false)
      return
    }
    setPassword("")
    setMessage("Connection checked and camera saved.")
    setSaving(false)
    router.refresh()
  }

  async function remove() {
    setRemoving(true)
    const response = await fetch(`/api/cameras/${camera.id}`, { method: "DELETE" })
    if (!response.ok && response.status !== 204) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null
      setError(body?.error ?? "The camera could not be removed.")
      setRemoving(false)
      dialogRef.current?.close()
      return
    }
    router.push("/dashboard/cameras")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/dashboard/cameras" className="text-sm font-semibold text-sl-primary">
          All cameras
        </Link>
        <h1 className="mt-2 text-2xl">{camera.name}</h1>
        <p className="mt-1 text-sm text-sl-text-muted">
          {camera.ipAddress}:{camera.onvifPort}
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-sl-danger/30 bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-sl-success/30 bg-sl-success/10 px-3 py-2 text-sm text-sl-success">
          {message}
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-border bg-sl-surface p-5 sm:grid-cols-2">
        <Info label="Brand" value={camera.brand || "Unknown"} />
        <Info label="Model" value={camera.model || "Unknown"} />
        <Info label="Firmware" value={camera.firmware || "Unknown"} />
        <Info label="IP address" value={`${camera.ipAddress}:${camera.onvifPort}`} />
        <div>
          <p className="text-xs tracking-wide text-sl-text-muted uppercase">Status</p>
          <p className="mt-1">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[camera.status]}`}>
              {statusLabel[camera.status]}
            </span>
          </p>
        </div>
        <Info
          label="PTZ"
          value={camera.ptzSupported ? "Supported" : "Not supported"}
        />
      </section>

      <section className="rounded-xl border border-border bg-sl-surface p-5">
        <h2 className="text-base">Status history</h2>
        {logs.length === 0 ? (
          <p className="mt-2 text-sm text-sl-text-muted">No status changes recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border text-sm">
            {logs.map((log) => (
              <li key={log.id} className="flex items-center justify-between py-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusStyle[log.status]}`}>
                  {statusLabel[log.status]}
                </span>
                <time className="text-sl-text-muted" dateTime={log.createdAt}>
                  {new Date(log.createdAt).toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="grid gap-3 rounded-xl border border-border bg-sl-surface p-5 sm:grid-cols-2"
        onSubmit={(event) => void save(event)}
      >
        <div className="sm:col-span-2">
          <h2 className="text-base">Edit camera</h2>
          <p className="mt-1 text-sm text-sl-text-muted">
            Saving checks the new credentials with the camera before they are stored.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="camera-name">Name</Label>
          <Input id="camera-name" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="camera-username">Username</Label>
          <Input id="camera-username" value={username} onChange={(event) => setUsername(event.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="camera-password">Password</Label>
          <Input
            id="camera-password"
            type="password"
            value={password}
            placeholder="Leave blank to keep the current password"
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? "Checking connection…" : "Save"}
          </Button>
          <Button type="button" variant="destructive" onClick={() => dialogRef.current?.showModal()}>
            Remove Camera
          </Button>
        </div>
      </form>

      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-sl-surface p-5 text-sl-text backdrop:bg-black/40"
      >
        <h2 className="text-base">Remove {camera.name}?</h2>
        <p className="mt-2 text-sm text-sl-text-muted">
          This deletes the saved camera and stops its stream. The camera itself is not factory-reset.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={removing} onClick={() => void remove()}>
            {removing ? "Removing…" : "Remove Camera"}
          </Button>
        </div>
      </dialog>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs tracking-wide text-sl-text-muted uppercase">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  )
}
