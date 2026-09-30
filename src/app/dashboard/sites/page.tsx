import { redirect } from "next/navigation"
import { SitesManager } from "@/components/sites/sites-manager"
import { prisma } from "@/server/db"
import { canManage, loadActor } from "@/server/access"

export default async function SitesPage() {
  const actor = await loadActor()
  if (!actor) redirect("/login")
  if (!canManage(actor.role)) redirect("/dashboard")

  const sites = await prisma.site.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { name: "asc" },
    include: {
      cameras: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  })

  return <SitesManager initialSites={sites} />
}
