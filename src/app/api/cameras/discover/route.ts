import { NextResponse } from "next/server"
import { authorize } from "@/server/access"
import { onvifFailure } from "@/server/cameras"
import { discoverCameras } from "@/server/onvif"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  try {
    const devices = await discoverCameras()
    return NextResponse.json({ devices })
  } catch (error) {
    return onvifFailure(error)
  }
}
