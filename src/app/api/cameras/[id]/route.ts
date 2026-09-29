import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { requireApiUser, unauthorized } from "@/server/cameras"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser()
  if (!user) return unauthorized()

  const { id } = await context.params
  const camera = await prisma.camera.findFirst({
    where: { id, site: { organizationId: user.organizationId } },
    select: { id: true },
  })
  if (!camera) {
    return NextResponse.json(
      { error: "Camera not found.", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  await prisma.camera.delete({ where: { id: camera.id } })
  return new NextResponse(null, { status: 204 })
}
