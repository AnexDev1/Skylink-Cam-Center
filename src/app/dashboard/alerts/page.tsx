import { redirect } from "next/navigation"
import { AlertsFeed } from "@/components/alerts/alerts-feed"
import { prisma } from "@/server/db"
import { toEventDto } from "@/server/events/types"
import { accessibleSiteWhere, canControl, loadActor } from "@/server/access"

export default async function AlertsPage() {
  const actor = await loadActor()
  if (!actor) redirect("/login")

  const siteWhere = await accessibleSiteWhere(actor)
  const [cameras, events] = await Promise.all([
    prisma.camera.findMany({
      where: { site: siteWhere },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.event.findMany({
      where: { camera: { site: siteWhere } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { camera: { select: { name: true, siteId: true } } },
    }),
  ])

  return (
    <AlertsFeed
      cameras={cameras}
      initialEvents={events.map(toEventDto)}
      canAcknowledge={canControl(actor.role)}
    />
  )
}