import { NextResponse } from "next/server"
import { onvifFailure, requireApiUser, unauthorized } from "@/server/cameras"
import { discoverCameras } from "@/server/onvif"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  const user = await requireApiUser()
  if (!user) return unauthorized()

  try {
    const devices = await discoverCameras()
    return NextResponse.json({ devices })
  } catch (error) {
    return onvifFailure(error)
  }
}
