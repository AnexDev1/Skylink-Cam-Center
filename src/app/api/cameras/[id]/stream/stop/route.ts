import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { requireApiUser, unauthorized } from "@/server/cameras"
import { StreamError, unregisterStream } from "@/server/streaming"

export const runtime = "nodejs"

export async function POST(
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

  try {
    await unregisterStream(camera.id)
    return NextResponse.json({ stopped: true })
  } catch (error) {
    const message =
      error instanceof StreamError
        ? error.message
        : "The stream could not be stopped."
    const code = error instanceof StreamError ? error.code : "STREAM_REJECTED"
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
