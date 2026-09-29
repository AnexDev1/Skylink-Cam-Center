import { NextResponse } from "next/server"
import { decrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import {
  onvifFailure,
  requireApiUser,
  toCameraDto,
  unauthorized,
} from "@/server/cameras"
import { connectToCamera } from "@/server/onvif"
import { mapOnvifError } from "@/server/onvif/errors"

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
  })
  if (!camera) {
    return NextResponse.json(
      { error: "Camera not found.", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  try {
    const connected = await connectToCamera(
      camera.ipAddress,
      camera.onvifPort,
      camera.username,
      decrypt(camera.encryptedPassword),
    )
    const updated = await prisma.camera.update({
      where: { id: camera.id },
      data: {
        status: "ONLINE",
        lastSeenAt: new Date(),
        brand: connected.manufacturer,
        model: connected.model,
        streamUrl: connected.streamUri,
      },
    })
    return NextResponse.json({
      camera: toCameraDto(updated),
      firmware: connected.firmware,
      ptz: connected.ptz,
    })
  } catch (error) {
    const mapped = mapOnvifError(error)
    await prisma.camera.update({
      where: { id: camera.id },
      data: {
        status: mapped.code === "ONVIF_UNREACHABLE" ? "OFFLINE" : "UNKNOWN",
      },
    })
    return onvifFailure(mapped)
  }
}
