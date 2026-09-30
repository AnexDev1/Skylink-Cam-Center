import { NextResponse } from "next/server"
import { decrypt } from "@/lib/crypto"
import { authorize, findScopedCamera, notFound } from "@/server/access"
import { deviceFailure } from "@/server/cameras"
import { fetchHikvisionSnapshot } from "@/server/hikvision/client"
import { fetchCameraSnapshot } from "@/server/onvif/snapshot"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("view")
  if (!actor) return response

  const { id } = await context.params
  const camera = await findScopedCamera(actor, id)
  if (!camera) return notFound("Camera")

  try {
    const password = decrypt(camera.encryptedPassword)
    const image =
      camera.protocol === "ISAPI"
        ? await fetchHikvisionSnapshot({
            ipAddress: camera.ipAddress,
            onvifPort: camera.onvifPort,
            channel: camera.channel,
            username: camera.username,
            password,
          })
        : await fetchCameraSnapshot({
            id: camera.id,
            ipAddress: camera.ipAddress,
            onvifPort: camera.onvifPort,
            username: camera.username,
            password,
          })
    return new NextResponse(new Uint8Array(image), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    return deviceFailure(error)
  }
}
