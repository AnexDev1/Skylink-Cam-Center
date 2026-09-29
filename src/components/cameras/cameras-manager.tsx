"use client"

import Link from "next/link"
import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CameraDto } from "@/server/cameras"

type SiteOption = { id: string; name: string }

type DiscoveredDevice = {
  ip: string
  port: number
  xaddr: string
  name: string | null
  hardware: string | null
}

type ApiError = { error?: string; code?: string }

const emptyManual = {
  name: "",
  ipAddress: "",
  onvifPort: "80",
  username: "",
  password: "",
}

export function CamerasManager({
  sites,
  initialCameras,
}: {
  sites: SiteOption[]
  initialCameras: CameraDto[]
}) {
  const [siteId, setSiteId] = useState(sites[0]?.id ?? "")
  const [cameras, setCameras] = useState(initialCameras)
  const [devices, setDevices] = useState<DiscoveredDevice[]>([])
  const [scanning, setScanning] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState(emptyManual)
  const [savingManual, setSavingManual] = useState(false)
  const [draft, setDraft] = useState<DiscoveredDevice | null>(null)
  const [draftForm, setDraftForm] = useState(emptyManual)
  const [savingDraft, setSavingDraft] = useState(false)

  const visibleCameras = cameras.filter((camera) => camera.siteId === siteId)

  async function readError(response: Response) {
    const body = (await response.json().catch(() => null)) as ApiError | null
    return body?.code
      ? `${body.code}: ${body.error ?? "Request failed."}`
      : (body?.error ?? "Request failed.")
  }

  async function loadCameras(nextSiteId = siteId) {
    if (!nextSiteId) return
    const response = await fetch(`/api/cameras?siteId=${encodeURIComponent(nextSiteId)}`)
    if (!response.ok) {
      setError(await readError(response))
      return
    }
    const body = (await response.json()) as { cameras: CameraDto[] }
    setCameras((current) => [
      ...current.filter((camera) => camera.siteId !== nextSiteId),
      ...body.cameras,
    ])
  }

  async function scanNetwork() {
    setScanning(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch("/api/cameras/discover", { method: "POST" })
      if (!response.ok) {
        setError(await readError(response))
        setDevices([])
        return
      }
      const body = (await response.json()) as { devices: DiscoveredDevice[] }
      setDevices(body.devices)
      setMessage(
        body.devices.length
          ? `Found ${body.devices.length} ONVIF device${body.devices.length === 1 ? "" : "s"}.`
          : "No ONVIF devices answered WS-Discovery on this subnet.",
      )
    } finally {
      setScanning(false)
    }
  }

  async function saveCamera(input: typeof emptyManual) {
    const response = await fetch("/api/cameras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        siteId,
        name: input.name,
        ipAddress: input.ipAddress,
        onvifPort: Number(input.onvifPort),
        username: input.username,
        password: input.password,
      }),
    })
    if (!response.ok) {
      setError(await readError(response))
      return false
    }
    const body = (await response.json()) as { camera: CameraDto }
    setCameras((current) => [...current.filter((item) => item.id !== body.camera.id), body.camera])
    setMessage(`Connected to ${body.camera.name}.`)
    setError(null)
    return true
  }

  async function testConnection(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/cameras/${id}/test-connection`, { method: "POST" })
      if (!response.ok) {
        setError(await readError(response))
        await loadCameras()
        return
      }
      const body = (await response.json()) as { camera: CameraDto }
      setCameras((current) =>
        current.map((camera) => (camera.id === body.camera.id ? body.camera : camera)),
      )
      setMessage(`${body.camera.name} is online.`)
    } finally {
      setBusyId(null)
    }
  }

  async function removeCamera(id: string) {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/cameras/${id}`, { method: "DELETE" })
      if (!response.ok && response.status !== 204) {
        setError(await readError(response))
        return
      }
      setCameras((current) => current.filter((camera) => camera.id !== id))
      setMessage("Camera removed.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Cameras"
        description="Discover ONVIF cameras on this subnet, or add one by address. Credentials are checked with the camera before they are stored."
      />

      {!sites.length ? (
        <p className="text-sm text-sl-text-muted">
          Create a site before adding cameras.
        </p>
      ) : (
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="camera-site">Site</Label>
          <select
            id="camera-site"
            value={siteId}
            onChange={(event) => {
              const next = event.target.value
              setSiteId(next)
              void loadCameras(next)
            }}
            className="h-9 w-full rounded-lg border border-input bg-sl-surface px-3 text-sm"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <p className="rounded-lg border border-sl-danger/30 bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger" role="alert">
          {error}
        </p>
      )}
      {message && <p className="text-sm text-sl-text-muted">{message}</p>}

      <section className="overflow-hidden rounded-xl border border-border bg-sl-surface shadow-sm">
        <div className="h-1.5 bg-sl-gradient" />
        <div className="flex flex-wrap items-center justify-between gap-3 p-5">
          <div>
            <h2 className="text-base">Network scan</h2>
            <p className="mt-1 text-sm text-sl-text-muted">
              WS-Discovery probes 239.255.255.250:3702. Cameras on another subnet need a manual address.
            </p>
          </div>
          <Button onClick={() => void scanNetwork()} disabled={scanning}>
            {scanning ? "Scanning…" : "Scan Network"}
          </Button>
        </div>
        <DeviceTable
          devices={devices}
          onAdd={(device) => {
            setDraft(device)
            setDraftForm({
              ...emptyManual,
              name: device.name || device.hardware || `Camera ${device.ip}`,
              ipAddress: device.ip,
              onvifPort: String(device.port),
            })
          }}
        />
        {draft && (
          <form
            className="grid gap-3 border-t border-border p-5 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              setSavingDraft(true)
              void saveCamera(draftForm).then((saved) => {
                if (saved) setDraft(null)
                setSavingDraft(false)
              })
            }}
          >
            <p className="sm:col-span-2 text-sm font-semibold">
              Add {draft.ip}:{draft.port}
            </p>
            <Field prefix="found" label="Name" value={draftForm.name} onChange={(name) => setDraftForm({ ...draftForm, name })} />
            <Field prefix="found" label="Username" value={draftForm.username} onChange={(username) => setDraftForm({ ...draftForm, username })} />
            <Field prefix="found" label="Password" type="password" value={draftForm.password} onChange={(password) => setDraftForm({ ...draftForm, password })} />
            <div className="flex items-end gap-2">
              <Button type="submit" disabled={savingDraft || !siteId}>
                {savingDraft ? "Connecting…" : "Verify and save"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-sl-surface shadow-sm">
        <div className="h-1.5 bg-sl-gradient" />
        <form
          className="grid gap-3 p-5 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            setSavingManual(true)
            void saveCamera(manual).then((saved) => {
              if (saved) setManual(emptyManual)
              setSavingManual(false)
            })
          }}
        >
          <div className="sm:col-span-2">
            <h2 className="text-base">Add camera manually</h2>
            <p className="mt-1 text-sm text-sl-text-muted">
              Use this when discovery cannot see the camera.
            </p>
          </div>
          <Field prefix="manual" label="Name" value={manual.name} onChange={(name) => setManual({ ...manual, name })} />
          <Field prefix="manual" label="IP address" value={manual.ipAddress} onChange={(ipAddress) => setManual({ ...manual, ipAddress })} />
          <Field prefix="manual" label="ONVIF port" value={manual.onvifPort} onChange={(onvifPort) => setManual({ ...manual, onvifPort })} />
          <Field prefix="manual" label="Username" value={manual.username} onChange={(username) => setManual({ ...manual, username })} />
          <Field prefix="manual" label="Password" type="password" value={manual.password} onChange={(password) => setManual({ ...manual, password })} />
          <div className="flex items-end">
            <Button type="submit" disabled={savingManual || !siteId}>
              {savingManual ? "Connecting…" : "Add Camera Manually"}
            </Button>
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-sl-surface">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-base">Saved cameras</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-xs tracking-wide text-sl-text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Brand / model</th>
                <th className="px-4 py-3 font-medium">IP</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Last seen</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleCameras.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-sl-text-muted">
                    No cameras saved for this site.
                  </td>
                </tr>
              ) : (
                visibleCameras.map((camera) => (
                  <tr key={camera.id} className="border-t border-border">
                    <td className="px-4 py-3 font-semibold">{camera.name}</td>
                    <td className="px-4 py-3">
                      {camera.brand} {camera.model}
                    </td>
                    <td className="px-4 py-3">
                      {camera.ipAddress}:{camera.onvifPort}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={camera.status} />
                    </td>
                    <td className="px-4 py-3 text-sl-text-muted">
                      {camera.lastSeenAt
                        ? new Date(camera.lastSeenAt).toLocaleString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/dashboard/cameras/${camera.id}`} />}
                        >
                          Details
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          nativeButton={false}
                          render={<Link href={`/dashboard/live/${camera.id}`} />}
                        >
                          Live
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === camera.id}
                          onClick={() => void testConnection(camera.id)}
                        >
                          {busyId === camera.id ? "Testing…" : "Test Connection"}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={busyId === camera.id}
                          onClick={() => void removeCamera(camera.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function DeviceTable({
  devices,
  onAdd,
}: {
  devices: DiscoveredDevice[]
  onAdd: (device: DiscoveredDevice) => void
}) {
  if (!devices.length) return null
  return (
    <div className="overflow-x-auto border-t border-border">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs tracking-wide text-sl-text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Address</th>
            <th className="px-4 py-3 font-medium">Service</th>
            <th className="px-4 py-3 font-medium" />
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={`${device.ip}:${device.port}`} className="border-t border-border">
              <td className="px-4 py-3 font-semibold">
                {device.name || device.hardware || "ONVIF device"}
              </td>
              <td className="px-4 py-3">
                {device.ip}:{device.port}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-sl-text-muted">{device.xaddr}</td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" onClick={() => onAdd(device)}>
                  Add
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Field({
  prefix,
  label,
  value,
  onChange,
  type = "text",
}: {
  prefix: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  const id = `${prefix}-${label.toLowerCase().replace(/\s+/g, "-")}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: CameraDto["status"] }) {
  const styles = {
    ONLINE: "bg-sl-success/15 text-sl-success",
    OFFLINE: "bg-sl-danger/15 text-sl-danger",
    UNKNOWN: "bg-muted text-sl-text-muted",
  } as const
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status === "ONLINE" ? "Online" : status === "OFFLINE" ? "Offline" : "Unknown"}
    </span>
  )
}
