import { NextResponse } from "next/server"
import { decrypt, encrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import {
  onvifFailure,
  requireApiUser,
  saveCameraState,
  toCameraDto,
  unauthorized,
} from "@/server/cameras"
import { connectToCamera, mapOnvifError } from "@/server/onvif"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const ipv4 =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

async function refreshStatus(camera: {
  id: string
  status: "ONLINE" | "OFFLINE" | "UNKNOWN"
  ipAddress: string
  onvifPort: number
  username: string
  encryptedPassword: string
}) {
  try {
    const connected = await connectToCamera(
      camera.ipAddress,
      camera.onvifPort,
      camera.username,
      decrypt(camera.encryptedPassword),
    )
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
    return saveCameraState(camera.id, camera.status, {
      status: mapped.code === "ONVIF_UNREACHABLE" ? "OFFLINE" : "UNKNOWN",
    })
  }
}

export async function GET(request: Request) {
  const user = await requireApiUser()
  if (!user) return unauthorized()

  const siteId = new URL(request.url).searchParams.get("siteId")
  if (!siteId) {
    return NextResponse.json(
      { error: "siteId is required.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId: user.organizationId },
    select: { id: true },
  })
  if (!site) {
    return NextResponse.json(
      { error: "Site not found.", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  const stored = await prisma.camera.findMany({
    where: { siteId },
    orderBy: { name: "asc" },
  })
  const refreshed = await Promise.all(stored.map((camera) => refreshStatus(camera)))

  return NextResponse.json({ cameras: refreshed.map(toCameraDto) })
}

export async function POST(request: Request) {
  const user = await requireApiUser()
  if (!user) return unauthorized()

  const body = (await request.json().catch(() => null)) as {
    siteId?: string
    name?: string
    ipAddress?: string
    onvifPort?: number
    username?: string
    password?: string
  } | null

  const siteId = body?.siteId?.trim() ?? ""
  const name = body?.name?.trim() ?? ""
  const ipAddress = body?.ipAddress?.trim() ?? ""
  const username = body?.username?.trim() ?? ""
  const password = body?.password ?? ""
  const onvifPort = Number(body?.onvifPort ?? 80)

  if (!siteId || !name || !ipAddress || !username || !password) {
    return NextResponse.json(
      { error: "Name, site, IP, username, and password are required.", code: "VALIDATION" },
      { status: 400 },
    )
  }
  if (!ipv4.test(ipAddress) || !Number.isInteger(onvifPort) || onvifPort < 1 || onvifPort > 65535) {
    return NextResponse.json(
      { error: "Enter a valid IPv4 address and ONVIF port.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const site = await prisma.site.findFirst({
    where: { id: siteId, organizationId: user.organizationId },
    select: { id: true },
  })
  if (!site) {
    return NextResponse.json(
      { error: "Site not found.", code: "NOT_FOUND" },
      { status: 404 },
    )
  }

  const duplicate = await prisma.camera.findFirst({
    where: { siteId, ipAddress, onvifPort },
    select: { id: true },
  })
  if (duplicate) {
    return NextResponse.json(
      { error: "That camera is already saved for this site.", code: "DUPLICATE" },
      { status: 409 },
    )
  }

  try {
    const connected = await connectToCamera(ipAddress, onvifPort, username, password)
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
    return onvifFailure(error)
  }
}
