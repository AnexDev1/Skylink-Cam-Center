import { NextResponse } from "next/server"
import { decrypt, encrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import { accessibleSiteWhere, authorize, notFound } from "@/server/access"
import {
  deviceFailure,
  saveCameraState,
  toCameraDto,
} from "@/server/cameras"
import { connectStored } from "@/server/devices/connect"
import { DeviceError } from "@/server/hikvision/errors"
import { mapOnvifError } from "@/server/onvif"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ipv4 =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

async function refreshStatus(camera: {
  id: string
  status: "ONLINE" | "OFFLINE" | "UNKNOWN"
  protocol: string
  ipAddress: string
  onvifPort: number
  rtspPort: number
  channel: number
  username: string
  encryptedPassword: string
}) {
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
    return saveCameraState(camera.id, camera.status, {
      status: "ONLINE",
      lastSeenAt: new Date(),
      brand: connected.manufacturer,
      model: connected.model,
      firmware: connected.firmware,
      ptzSupported: connected.ptz,
      streamUrl: connected.streamUri,
    })
  } catch (error) {
    const mapped = mapOnvifError(error)
    const offline =
      mapped.code === "ONVIF_UNREACHABLE" ||
      (error instanceof DeviceError &&
        (error.code === "UNREACHABLE" || error.code === "RTSP_UNREACHABLE"))
    return saveCameraState(camera.id, camera.status, {
      status: offline ? "OFFLINE" : "UNKNOWN",
    })
  }
}

export async function GET(request: Request) {
  const { actor, response } = await authorize("view")
  if (!actor) return response

  const siteId = new URL(request.url).searchParams.get("siteId")
  if (!siteId) {
    return NextResponse.json(
      { error: "siteId is required.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, ...(await accessibleSiteWhere(actor)) },
    select: { id: true },
  })
  if (!site) return notFound("Site")

  const stored = await prisma.camera.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
  })
  const refreshed = await Promise.all(stored.map((camera) => refreshStatus(camera)))

  return NextResponse.json({ cameras: refreshed.map(toCameraDto) })
}

export async function POST(request: Request) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const body = (await request.json().catch(() => null)) as {
    siteId?: string
    name?: string
    ipAddress?: string
    onvifPort?: number
    protocol?: string
    rtspPort?: number
    channel?: number
    username?: string
    password?: string
  } | null

  const siteId = body?.siteId?.trim() ?? ""
  const name = body?.name?.trim() ?? ""
  const ipAddress = body?.ipAddress?.trim() ?? ""
  const username = body?.username?.trim() ?? ""
  const password = body?.password ?? ""
  const protocol = body?.protocol === "ISAPI" ? "ISAPI" : "ONVIF"
  const onvifPort = Number(body?.onvifPort ?? 80)
  const rtspPort = Number(body?.rtspPort ?? 554)
  const channel = Number(body?.channel ?? 1)

  if (!siteId || !name || !ipAddress || !username || !password) {
    return NextResponse.json(
      { error: "Name, site, IP, username, and password are required.", code: "VALIDATION" },
      { status: 400 },
    )
  }
  if (
    !ipv4.test(ipAddress) ||
    !Number.isInteger(onvifPort) ||
    onvifPort < 1 ||
    onvifPort > 65535 ||
    !Number.isInteger(rtspPort) ||
    rtspPort < 1 ||
    rtspPort > 65535 ||
    !Number.isInteger(channel) ||
    channel < 1 ||
    channel > 32
  ) {
    return NextResponse.json(
      { error: "Enter a valid IPv4 address, port, and channel.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId: actor.organizationId },
    select: { id: true },
  })
  if (!site) return notFound("Site")

  const duplicate = await prisma.camera.findFirst({
    where:
      protocol === "ISAPI"
        ? { siteId, ipAddress, protocol, channel }
        : { siteId, ipAddress, onvifPort, protocol: "ONVIF" },
    select: { id: true },
  })
  if (duplicate) {
    return NextResponse.json(
      { error: "That camera is already saved for this site.", code: "DUPLICATE" },
      { status: 409 },
    )
  }

  try {
    const connected = await connectStored({
      protocol,
      ipAddress,
      onvifPort,
      rtspPort,
      channel,
      username,
      password,
    })
    const camera = await prisma.camera.create({
      data: {
        siteId,
        name,
        brand: connected.manufacturer,
        model: connected.model,
        firmware: connected.firmware,
        ptzSupported: connected.ptz,
        ipAddress,
        onvifPort,
        protocol,
        rtspPort,
        channel,
        username,
        encryptedPassword: encrypt(password),
        streamUrl: connected.streamUri,
        status: "ONLINE",
        lastSeenAt: new Date(),
        statusLogs: { create: { status: "ONLINE" } },
      },
    })

    return NextResponse.json(
      {
        camera: toCameraDto(camera),
        firmware: connected.firmware,
        ptz: connected.ptz,
      },
      { status: 201 },
    )
  } catch (error) {
    return deviceFailure(error)
  }
}
