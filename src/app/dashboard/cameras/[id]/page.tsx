import { notFound, redirect } from "next/navigation"
import { CameraDetail } from "@/components/cameras/camera-detail"
import { auth } from "@/auth"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"

export default async function CameraDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params
  const camera = await prisma.camera.findFirst({
    where: {
      id,
      site: { organizationId: session.user.organizationId },
    },
    include: {
      statusLogs: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  })
  if (!camera) notFound()

  return (
    <CameraDetail
      camera={toCameraDto(camera)}
      logs={camera.statusLogs.map((log) => ({
        id: log.id,
        status: log.status,
        createdAt: log.createdAt.toISOString(),
      }))}
    />
  )
}
