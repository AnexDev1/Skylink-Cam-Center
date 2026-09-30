import { NextResponse } from "next/server"
import { decrypt } from "@/lib/crypto"
import { authorize, findScopedCamera, notFound } from "@/server/access"
import {
  deviceFailure,
  saveCameraState,
  toCameraDto,
} from "@/server/cameras"
import { connectStored } from "@/server/devices/connect"
import { DeviceError } from "@/server/hikvision/errors"
import { mapOnvifError } from "@/server/onvif/errors"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  const camera = await findScopedCamera(actor, id)
  if (!camera) return notFound("Camera")

  try {
    const connected = await connectStored({
      protocol: camera.protocol,
      ipAddress: camera.ipAddress,
      onvifPort: camera.onvifPort,
      rtspPort: camera.rtspPort,
      channel: camera.channel,
      username: camera.username,
      password: decrypt(camera.encryptedPassword),
    })
    const updated = await saveCameraState(camera.id, camera.status, {
      status: "ONLINE",
      lastSeenAt: new Date(),
      brand: connected.manufacturer,
      model: connected.model,
      firmware: connected.firmware,
      ptzSupported: connected.ptz,
      streamUrl: connected.streamUri,
    })
    return NextResponse.json({
      camera: toCameraDto(updated),
      firmware: connected.firmware,
      ptz: connected.ptz,
    })
  } catch (error) {
    const mapped = mapOnvifError(error)
    const offline =
      mapped.code === "ONVIF_UNREACHABLE" ||
      (error instanceof DeviceError &&
        (error.code === "UNREACHABLE" || error.code === "RTSP_UNREACHABLE"))
    await saveCameraState(camera.id, camera.status, {
      status: offline ? "OFFLINE" : "UNKNOWN",
    })
    return deviceFailure(error)
  }
}
