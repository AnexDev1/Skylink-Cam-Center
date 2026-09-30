"use client"

import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { roles, type Role } from "@/types/auth"

type SiteOption = { id: string; name: string }
type UserRecord = {
  id: string
  name: string
  email: string
  role: Role
  siteIds: string[]
}

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "VIEWER" as Role,
  siteIds: [] as string[],
}

const fieldClass = "h-8 rounded-lg border border-border bg-sl-surface px-2 text-sm"

export function UsersManager({
  initialUsers,
  sites,
  currentUserId,
}: {
  initialUsers: UserRecord[]
  sites: SiteOption[]
  currentUserId: string
}) {
  const [users, setUsers] = useState(initialUsers)
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<UserRecord | null>(null)
  const [editPassword, setEditPassword] = useState("")
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function readError(response: Response) {
    const body = (await response.json().catch(() => null)) as { error?: string; code?: string } | null
    return body?.code ? `${body.code}: ${body.error ?? "Request failed."}` : (body?.error ?? "Request failed.")
  }

  function toggleSite(siteIds: string[], siteId: string) {
    return siteIds.includes(siteId) ? siteIds.filter((id) => id !== siteId) : [...siteIds, siteId]
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault()
    setPending("create")
    setError(null)
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    if (!response.ok) {
      setError(await readError(response))
      setPending(null)
      return
    }
    const body = (await response.json()) as { user: UserRecord }
    setUsers((current) => [...current, body.user].sort((a, b) => a.name.localeCompare(b.name)))
    setForm(emptyForm)
    setPending(null)
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault()
    if (!editing) return
    setPending(editing.id)
    setError(null)
    const response = await fetch(`/api/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editing.name,
        role: editing.role,
        siteIds: editing.siteIds,
        password: editPassword,
      }),
    })
    if (!response.ok) {
      setError(await readError(response))
      setPending(null)
      return
    }
    setUsers((current) =>
      current
        .map((user) => (user.id === editing.id ? editing : user))
        .sort((a, b) => a.name.localeCompare(b.name)),
    )
    setEditing(null)
    setEditPassword("")
    setPending(null)
  }

  async function removeUser(user: UserRecord) {
    setPending(user.id)
    setError(null)
    const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" })
    if (!response.ok && response.status !== 204) {
      setError(await readError(response))
      setPending(null)
      return
    }
    setUsers((current) => current.filter((item) => item.id !== user.id))
    if (editing?.id === user.id) setEditing(null)
    setPending(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Create accounts, assign a role, and choose which sites they can open. Admins can open every site."
      />
      {error ? (
        <p className="rounded-lg border border-sl-danger/30 bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger" role="alert">
          {error}
        </p>
      ) : null}

      <form onSubmit={(event) => void createUser(event)} className="grid gap-3 rounded-xl border border-border bg-sl-surface p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <h2 className="text-base">Create user</h2>
          <p className="mt-1 text-sm text-sl-text-muted">
            Share the password with them. They sign in with this email.
          </p>
        </div>
        <Field id="user-name" label="Name" value={form.name} onChange={(name) => setForm({ ...form, name })} />
        <Field id="user-email" label="Email" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
        <Field id="user-password" label="Password" type="password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
        <RoleField value={form.role} onChange={(role) => setForm({ ...form, role })} />
        <SiteChecks
          sites={sites}
          selected={form.siteIds}
          onToggle={(siteId) => setForm({ ...form, siteIds: toggleSite(form.siteIds, siteId) })}
        />
        <div className="flex items-end">
          <Button type="submit" disabled={pending === "create"}>
            {pending === "create" ? "Creating…" : "Create user"}
          </Button>
        </div>
      </form>

      {editing ? (
        <form onSubmit={(event) => void saveUser(event)} className="grid gap-3 rounded-xl border border-border bg-sl-surface p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <h2 className="text-base">Edit {editing.email}</h2>
          </div>
          <Field id="edit-name" label="Name" value={editing.name} onChange={(name) => setEditing({ ...editing, name })} />
          <RoleField value={editing.role} onChange={(role) => setEditing({ ...editing, role })} />
          <Field
            id="edit-password"
            label="New password"
            type="password"
            value={editPassword}
            required={false}
            onChange={setEditPassword}
          />
          <SiteChecks
            sites={sites}
            selected={editing.siteIds}
            onToggle={(siteId) => setEditing({ ...editing, siteIds: toggleSite(editing.siteIds, siteId) })}
          />
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pending === editing.id}>Save</Button>
            <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-border bg-sl-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-sl-text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Sites</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold">{user.name}</td>
                  <td className="px-4 py-3">{user.email}</td>
                  <td className="px-4 py-3">{user.role}</td>
                  <td className="px-4 py-3 text-sl-text-muted">
                    {user.role === "ADMIN"
                      ? "All sites"
                      : sites.filter((site) => user.siteIds.includes(site.id)).map((site) => site.name).join(", ") || "None"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { setEditing(user); setEditPassword("") }}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={user.id === currentUserId || pending === user.id}
                        onClick={() => void removeUser(user)}
                      >
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = true,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} required={required} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function RoleField({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium">Role</span>
      <select className={fieldClass} value={value} onChange={(event) => onChange(event.target.value as Role)}>
        {roles.map((role) => (
          <option key={role} value={role}>
            {role}
          </option>
        ))}
      </select>
    </label>
  )
}

function SiteChecks({
  sites,
  selected,
  onToggle,
}: {
  sites: SiteOption[]
  selected: string[]
  onToggle: (siteId: string) => void
}) {
  return (
    <fieldset className="sm:col-span-2">
      <legend className="text-sm font-medium">Site access</legend>
      <div className="mt-2 flex flex-wrap gap-3">
        {sites.map((site) => (
          <label key={site.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.includes(site.id)}
              onChange={() => onToggle(site.id)}
            />
            {site.name}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
