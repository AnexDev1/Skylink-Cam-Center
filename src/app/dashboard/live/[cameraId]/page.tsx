import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { PtzControls } from "@/components/live/ptz-controls"
import { SnapshotButton } from "@/components/live/snapshot-button"
import { StreamPlayer } from "@/components/live/stream-player"
import { auth } from "@/auth"
import { prisma } from "@/server/db"
import { toCameraDto } from "@/server/cameras"

export default async function CameraLivePage({
  params,
}: {
  params: Promise<{ cameraId: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { cameraId } = await params
  const camera = await prisma.camera.findFirst({
    where: {
      id: cameraId,
      site: { organizationId: session.user.organizationId },
    },
  })
  if (!camera) notFound()
  const dto = toCameraDto(camera)

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/live" className="text-sm font-semibold text-sl-primary">
          All cameras
        </Link>
        <Link href={`/dashboard/cameras/${dto.id}`} className="text-sm font-semibold text-sl-primary">
          Camera details
        </Link>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <StreamPlayer camera={dto} autoStart />
        <div className="flex flex-col gap-4">
          {dto.ptzSupported ? <PtzControls cameraId={dto.id} /> : null}
          <SnapshotButton cameraId={dto.id} cameraName={dto.name} />
        </div>
      </div>
    </div>
  )
}
