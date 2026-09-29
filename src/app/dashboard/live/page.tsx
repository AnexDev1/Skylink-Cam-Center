import { redirect } from "next/navigation"
import { LiveGrid } from "@/components/live/live-grid"
import { auth } from "@/auth"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"

export default async function LiveViewPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const sites = await prisma.site.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  })
  const cameras = await prisma.camera.findMany({
    where: { site: { organizationId: session.user.organizationId } },
    orderBy: { name: "asc" },
  })

  return <LiveGrid sites={sites} cameras={cameras.map(toCameraDto)} />
}
