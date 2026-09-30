import { notFound, redirect } from "next/navigation"
import { CameraDetail } from "@/components/cameras/camera-detail"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"
import { accessibleSiteWhere, canManage, loadActor } from "@/server/access"

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await loadActor()
  if (!actor) redirect("/login")

  const { id } = await params
  const camera = await prisma.camera.findFirst({
    where: {
      id,
      site: await accessibleSiteWhere(actor),
    },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  })
  if (!camera) notFound()

  return (
    <CameraDetail
      canManage={canManage(actor.role)}
      camera={toCameraDto(camera)}
      logs={camera.statusLogs.map((log) => ({
        id: log.id,
        status: log.status,
        createdAt: log.createdAt.toISOString(),
      }))}
    />
  )
}
