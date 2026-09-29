import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { OnvifError } from "@/server/onvif/errors"
import type { CameraStatus } from "@/generated/prisma/client"

export async function requireApiUser() {
  const session = await auth()
  if (!session?.user?.id || !session.user.organizationId) return null
  return session.user
}

export function unauthorized() {
  return NextResponse.json(
    { error: "Sign in required.", code: "UNAUTHENTICATED" },
    { status: 401 },
  )
}

export function onvifFailure(error: unknown) {
  const mapped =
    error instanceof OnvifError
      ? error
      : new OnvifError("ONVIF_REQUEST_FAILED", "The ONVIF request failed.")
  const status =
    mapped.code === "ONVIF_AUTH_FAILED"
      ? 401
      : mapped.code === "ONVIF_UNSUPPORTED_OPERATION"
        ? 422
        : mapped.code === "ONVIF_UNREACHABLE"
          ? 504
          : 502

  return NextResponse.json(
    { error: mapped.message, code: mapped.code },
    { status },
  )
}

export type CameraDto = {
  id: string
  siteId: string
  name: string
  brand: string
  model: string
  ipAddress: string
  onvifPort: number
  username: string
  streamUrl: string | null
  status: CameraStatus
  lastSeenAt: string | null
}

export function toCameraDto(camera: {
  id: string
  siteId: string
  name: string
  brand: string
  model: string
  ipAddress: string
  onvifPort: number
  username: string
  streamUrl: string | null
  status: CameraStatus
  lastSeenAt: Date | null
}): CameraDto {
  return {
    id: camera.id,
    siteId: camera.siteId,
    name: camera.name,
    brand: camera.brand,
    model: camera.model,
    ipAddress: camera.ipAddress,
    onvifPort: camera.onvifPort,
    username: camera.username,
    streamUrl: camera.streamUrl,
    status: camera.status,
    lastSeenAt: camera.lastSeenAt?.toISOString() ?? null,
  }
}
