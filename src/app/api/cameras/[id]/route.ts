import { NextResponse } from "next/server"
import { decrypt, encrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import { authorize, findScopedCamera, notFound } from "@/server/access"
import {
  deviceFailure,
  saveCameraState,
  toCameraDto,
} from "@/server/cameras"
import { connectStored } from "@/server/devices/connect"
import { closeCamera } from "@/server/onvif/session"
import { unregisterStream } from "@/server/streaming"

export const runtime = "nodejs"

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  const camera = await findScopedCamera(actor, id)
  if (!camera) return notFound("Camera")

  await unregisterStream(camera.id).catch(() => undefined)
  closeCamera(camera.id)
  await prisma.camera.delete({ where: { id: camera.id } })
  return new NextResponse(null, { status: 204 })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  const camera = await findScopedCamera(actor, id)
  if (!camera) return notFound("Camera")

  const body = (await request.json().catch(() => null)) as {
    name?: string
    username?: string
    password?: string
    siteId?: string
  } | null
  const nextSiteId = body?.siteId?.trim() ?? ""
  if (nextSiteId) {
    const site = await prisma.site.findFirst({
      where: { id: nextSiteId, organizationId: actor.organizationId },
      select: { id: true },
    })
    if (!site) return notFound("Site")
  }

  const name = body?.name?.trim() ?? ""
  const username = body?.username?.trim() ?? ""
  if (!name && !username && !body?.password && nextSiteId) {
    const updated = await prisma.camera.update({
      where: { id: camera.id },
      data: { siteId: nextSiteId },
    })
    return NextResponse.json({ camera: toCameraDto(updated) })
  }

  const password = body?.password?.length ? body.password : decrypt(camera.encryptedPassword)

  if (!name || !username) {
    return NextResponse.json(
      { error: "Name and username are required.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  try {
    const connected = await connectStored({
      protocol: camera.protocol,
      ipAddress: camera.ipAddress,
      onvifPort: camera.onvifPort,
      rtspPort: camera.rtspPort,
      channel: camera.channel,
      username,
      password,
    })
    closeCamera(camera.id)
    const updated = await saveCameraState(camera.id, camera.status, {
      name,
      username,
      ...(nextSiteId ? { siteId: nextSiteId } : {}),
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
    return deviceFailure(error)
  }
}
