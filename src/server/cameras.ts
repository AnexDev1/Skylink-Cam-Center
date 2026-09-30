import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { DeviceError } from "@/server/hikvision/errors"
import { OnvifError } from "@/server/onvif/errors"
import type { CameraStatus } from "@/generated/prisma/client"

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

export function deviceFailure(error: unknown) {
  if (!(error instanceof DeviceError)) return onvifFailure(error)
  const status =
    error.code === "AUTH_FAILED" ? 401 : error.code === "UNREACHABLE" ? 504 : 502
  return NextResponse.json({ error: error.message, code: error.code }, { status })
}

export type CameraDto = {
  id: string
  siteId: string
  name: string
  brand: string
  model: string
  ipAddress: string
  onvifPort: number
  protocol: string
  rtspPort: number
  channel: number
  username: string
  streamUrl: string | null
  firmware: string
  ptzSupported: boolean
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
  protocol: string
  rtspPort: number
  channel: number
  username: string
  streamUrl: string | null
  firmware: string
  ptzSupported: boolean
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
    protocol: camera.protocol,
    rtspPort: camera.rtspPort,
    channel: camera.channel,
    username: camera.username,
    streamUrl: camera.streamUrl,
    firmware: camera.firmware,
    ptzSupported: camera.ptzSupported,
    status: camera.status,
    lastSeenAt: camera.lastSeenAt?.toISOString() ?? null,
  }
}

export async function saveCameraState(
  id: string,
  previousStatus: CameraStatus,
  data: {
    status?: CameraStatus
    lastSeenAt?: Date
    brand?: string
    model?: string
    firmware?: string
    ptzSupported?: boolean
    streamUrl?: string | null
    name?: string
    username?: string
    encryptedPassword?: string
    siteId?: string
  },
) {
  const updated = await prisma.camera.update({ where: { id }, data })
  if (data.status && data.status !== previousStatus) {
    await prisma.cameraStatusLog.create({
      data: { cameraId: id, status: data.status },
    })
  }
  return updated
}
