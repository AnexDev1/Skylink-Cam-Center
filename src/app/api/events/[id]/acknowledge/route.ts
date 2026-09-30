import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { accessibleSiteWhere, authorize, notFound } from "@/server/access"
import { publishAcknowledged } from "@/server/events/bus"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("control")
  if (!actor) return response

  const { id } = await context.params
  const event = await prisma.event.findFirst({
    where: {
      id,
      camera: { site: await accessibleSiteWhere(actor) },
    },
    select: { id: true, acknowledged: true, camera: { select: { siteId: true } } },
  })
  if (!event) return notFound("Alert")

  if (!event.acknowledged) {
    await prisma.event.update({
      where: { id: event.id },
      data: { acknowledged: true },
    })
    publishAcknowledged(actor.organizationId, event.id, event.camera.siteId)
  }

  return NextResponse.json({ acknowledged: true })
}
