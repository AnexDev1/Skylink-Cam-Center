import Link from "next/link"
import { redirect } from "next/navigation"
import { SiteSelector } from "@/components/dashboard/site-selector"
import { PageHeader } from "@/components/layout/page-header"
import { prisma } from "@/server/db"
import { accessibleSiteWhere, loadActor } from "@/server/access"

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string }>
}) {
  const actor = await loadActor()
  if (!actor) redirect("/login")

  const { site: requestedSite } = await searchParams
  const sites = await prisma.site.findMany({
    where: await accessibleSiteWhere(actor),
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  const selected = sites.find((site) => site.id === requestedSite) ?? null
  const siteWhere = selected
    ? { id: selected.id, organizationId: actor.organizationId }
    : await accessibleSiteWhere(actor)

  const organization = await prisma.organization.findUnique({
    where: { id: actor.organizationId },
    select: { name: true },
  })
  const scopeName = selected?.name ?? (sites.length === 1 ? sites[0]?.name : "All assigned sites")

  const [total, online, offline, recent] = await Promise.all([
    prisma.camera.count({ where: { site: siteWhere } }),
    prisma.camera.count({ where: { site: siteWhere, status: "ONLINE" } }),
    prisma.camera.count({ where: { site: siteWhere, status: "OFFLINE" } }),
    prisma.event.findMany({
      where: { camera: { site: siteWhere } },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { camera: { select: { name: true, site: { select: { name: true } } } } },
    }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader
          title="Control center"
          description={`${organization?.name ?? "Organization"} · ${scopeName} · ${actor.name}, ${actor.role}.`}
        />
        {sites.length > 1 ? (
          <SiteSelector sites={sites} selectedId={selected?.id ?? ""} />
        ) : null}
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Cameras" value={total} />
        <Stat label="Online" value={online} tone="text-sl-success" />
        <Stat label="Offline" value={offline} tone="text-sl-danger" />
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-sl-surface">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base">Recent alerts</h2>
          <Link href="/dashboard/alerts" className="text-sm font-semibold text-sl-primary">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-5 py-8 text-sm text-sl-text-muted">No alerts for this view yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((event) => (
              <li key={event.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="text-xs font-semibold tracking-wide text-sl-text-muted uppercase">
                  {event.type}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {event.camera.name}
                    <span className="font-normal text-sl-text-muted"> · {event.camera.site.name}</span>
                  </p>
                  <p className="text-sm text-sl-text-muted">{event.message}</p>
                </div>
                <time className="text-xs text-sl-text-muted" dateTime={event.createdAt.toISOString()}>
                  {event.createdAt.toLocaleString()}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <article className="rounded-xl border border-border bg-sl-surface p-5 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-sl-text-muted uppercase">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${tone ?? ""}`}>{value}</p>
    </article>
  )
}
