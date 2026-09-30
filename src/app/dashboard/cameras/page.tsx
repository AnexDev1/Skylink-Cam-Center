import { redirect } from "next/navigation"
import { CamerasManager } from "@/components/cameras/cameras-manager"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"
import { accessibleSiteWhere, canManage, loadActor } from "@/server/access"

export default async function CamerasPage() {
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

  return (
    <CamerasManager
      sites={sites}
      initialCameras={cameras.map(toCameraDto)}
      canManage={canManage(actor.role)}
    />
  )
}
