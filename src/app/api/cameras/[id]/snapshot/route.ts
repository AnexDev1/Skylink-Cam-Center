import { NextResponse } from "next/server"
import { decrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import { onvifFailure, requireApiUser, unauthorized } from "@/server/cameras"
import { fetchCameraSnapshot } from "@/server/onvif/snapshot"

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
    const image = await fetchCameraSnapshot({
      id: camera.id,
      ipAddress: camera.ipAddress,
      onvifPort: camera.onvifPort,
      username: camera.username,
      password: decrypt(camera.encryptedPassword),
    })
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return onvifFailure(error)
  }
}
