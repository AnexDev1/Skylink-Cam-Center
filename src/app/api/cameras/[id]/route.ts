import { NextResponse } from "next/server"
import { decrypt, encrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import {
  onvifFailure,
  requireApiUser,
  saveCameraState,
  toCameraDto,
  unauthorized,
} from "@/server/cameras"
import { connectToCamera } from "@/server/onvif"
import { closeCamera } from "@/server/onvif/session"
import { unregisterStream } from "@/server/streaming"

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

  await unregisterStream(camera.id).catch(() => undefined)
  closeCamera(camera.id)
  await prisma.camera.delete({ where: { id: camera.id } })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireApiUser()
  if (!user) return unauthorized()

  const { id } = await context.params
  const camera = await prisma.camera.findFirst({
    where: { id, site: { organizationId: user.organizationId } },
  })
  if (!camera) {
    return NextResponse.json(
      { error: "Camera not found.", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  const body = (await request.json().catch(() => null)) as {
    name?: string
    username?: string
    password?: string
  } | null
  const name = body?.name?.trim() ?? ""
  const username = body?.username?.trim() ?? ""
  const password = body?.password?.length ? body.password : decrypt(camera.encryptedPassword)

  if (!name || !username) {
    return NextResponse.json(
      { error: "Name and username are required.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  try {
    const connected = await connectToCamera(
      camera.ipAddress,
      camera.onvifPort,
      username,
      password,
    )
    closeCamera(camera.id)
    const updated = await saveCameraState(camera.id, camera.status, {
      name,
      username,
      encryptedPassword: encrypt(password),
      brand: connected.manufacturer,
      model: connected.model,
      firmware: connected.firmware,
      ptzSupported: connected.ptz,
      streamUrl: connected.streamUri,
      status: "ONLINE",
      lastSeenAt: new Date(),
    })
    return NextResponse.json({ camera: toCameraDto(updated) })
  } catch (error) {
    return onvifFailure(error)
  }
}
