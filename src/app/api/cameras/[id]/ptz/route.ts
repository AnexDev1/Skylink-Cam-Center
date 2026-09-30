import { NextResponse } from "next/server"
import { decrypt } from "@/lib/crypto"
import { authorize, findScopedCamera, notFound } from "@/server/access"
import { onvifFailure } from "@/server/cameras"
import { homeCamera, moveCamera, ptzDirections, stopCamera, type PtzDirection } from "@/server/onvif/ptz"

export const runtime = "nodejs"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("control")
  if (!actor) return response

  const { id } = await context.params
  const camera = await findScopedCamera(actor, id)
  if (!camera) return notFound("Camera")

  const body = (await request.json().catch(() => null)) as {
    action?: string
    direction?: string
  } | null
  const action = body?.action
  const direction = body?.direction

  if (action !== "move" && action !== "stop" && action !== "home") {
    return NextResponse.json(
      { error: "Action must be move, stop, or home.", code: "VALIDATION" },
      { status: 400 },
    )
  }
  if (action === "move" && !ptzDirections.includes(direction as PtzDirection)) {
    return NextResponse.json(
      { error: "Choose a PTZ direction.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const target = {
    id: camera.id,
    ipAddress: camera.ipAddress,
    onvifPort: camera.onvifPort,
    username: camera.username,
    password: decrypt(camera.encryptedPassword),
    ptzSupported: camera.ptzSupported,
  }

  try {
    if (action === "move") await moveCamera(target, direction as PtzDirection)
    else if (action === "home") await homeCamera(target)
    else await stopCamera(target)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return onvifFailure(error)
  }
}
