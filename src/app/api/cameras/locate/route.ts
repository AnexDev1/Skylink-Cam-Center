import { NextResponse } from "next/server"
import { authorize } from "@/server/access"
import { discoverCameras } from "@/server/onvif"
import { discoverSadp, sadpMatches } from "@/server/onvif/sadp"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const body = (await request.json().catch(() => null)) as { serial?: string } | null
  const serial = body?.serial?.trim() ?? ""
  if (serial.length < 6) {
    return NextResponse.json(
      { error: "A device serial is required.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const [sadpDevices, onvifDevices] = await Promise.all([
    discoverSadp().catch(() => []),
    discoverCameras().catch(() => []),
  ])

  const sadp = sadpDevices.find((device) => sadpMatches(device, serial))
  if (sadp) {
    return NextResponse.json({
      device: {
        ip: sadp.ip,
        port: sadp.httpPort,
        name: sadp.model || serial,
        source: "sadp",
      },
    })
  }

  const needle = serial.toUpperCase()
  const onvif = onvifDevices.find((device) =>
    `${device.name ?? ""} ${device.hardware ?? ""} ${device.scopes}`.toUpperCase().includes(needle),
  )
  if (onvif) {
    return NextResponse.json({
      device: {
        ip: onvif.ip,
        port: onvif.port,
        name: onvif.name || onvif.hardware || serial,
        source: "onvif",
      },
    })
  }

  return NextResponse.json({ device: null })
}
