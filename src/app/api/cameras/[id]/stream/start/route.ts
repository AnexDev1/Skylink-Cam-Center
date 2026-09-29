import { NextResponse } from "next/server"
import { decrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import {
  onvifFailure,
  requireApiUser,
  saveCameraState,
  toCameraDto,
  unauthorized,
} from "@/server/cameras"
import { connectToCamera } from "@/server/onvif"
import { mapOnvifError } from "@/server/onvif/errors"
import { StreamError, registerStream } from "@/server/streaming"

export const runtime = "nodejs"

function withRtspCredentials(rtspUrl: string, username: string, password: string) {
  const url = new URL(rtspUrl)
  if (!url.username) {
    url.username = username
    url.password = password
  }
  return url.toString()
}

function streamFailure(error: unknown) {
  if (!(error instanceof StreamError)) {
    return NextResponse.json(
      { error: "The stream could not be started.", code: "STREAM_REJECTED" },
      { status: 502 },
    )
  }
  const status = error.code === "STREAM_NO_SOURCE" ? 422 : 502
  return NextResponse.json({ error: error.message, code: error.code }, { status })
}

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
    if (!connected.streamUri) {
      throw new StreamError(
        "STREAM_NO_SOURCE",
        "The camera did not return an RTSP stream address.",
      )
    }

    const playback = await registerStream(
      camera.id,
      withRtspCredentials(
        connected.streamUri,
        camera.username,
        decrypt(camera.encryptedPassword),
      ),
    )
    const updated = await saveCameraState(camera.id, camera.status, {
      status: "ONLINE",
      lastSeenAt: new Date(),
      brand: connected.manufacturer,
      model: connected.model,
      firmware: connected.firmware,
      ptzSupported: connected.ptz,
      streamUrl: connected.streamUri,
    })

    return NextResponse.json({ camera: toCameraDto(updated), playback })
  } catch (error) {
    if (error instanceof StreamError) return streamFailure(error)
    const mapped = mapOnvifError(error)
    await saveCameraState(camera.id, camera.status, {
      status: mapped.code === "ONVIF_UNREACHABLE" ? "OFFLINE" : "UNKNOWN",
    })
    return onvifFailure(mapped)
  }
}
