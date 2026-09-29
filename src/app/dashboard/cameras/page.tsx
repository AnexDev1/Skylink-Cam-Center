import { redirect } from "next/navigation"
import { CamerasManager } from "@/components/cameras/cameras-manager"
import { auth } from "@/auth"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"

export default async function CamerasPage() {
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

  return (
    <CamerasManager
      sites={sites}
      initialCameras={cameras.map(toCameraDto)}
    />
  )
}
