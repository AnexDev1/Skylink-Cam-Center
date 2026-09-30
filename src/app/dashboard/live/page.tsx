import { redirect } from "next/navigation"
import { LiveGrid } from "@/components/live/live-grid"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"
import { accessibleSiteWhere, loadActor } from "@/server/access"

export default async function LiveViewPage() {
  const actor = await loadActor()
  if (!actor) redirect("/login")

  const siteWhere = await accessibleSiteWhere(actor)
  const sites = await prisma.site.findMany({
    where: siteWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  const cameras = await prisma.camera.findMany({
    where: { site: siteWhere },
    orderBy: { name: "asc" },
  })

  return <LiveGrid sites={sites} cameras={cameras.map(toCameraDto)} />
}
