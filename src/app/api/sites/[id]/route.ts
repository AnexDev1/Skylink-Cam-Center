import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { authorize, notFound } from "@/server/access"

export const runtime = "nodejs"

async function findSite(organizationId: string, id: string) {
  return prisma.site.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  const site = await findSite(actor.organizationId, id)
  if (!site) return notFound("Site")

  const body = (await request.json().catch(() => null)) as {
    name?: string
    address?: string
  } | null
  const name = body?.name?.trim() ?? ""
  const address = body?.address?.trim() ?? ""
  if (!name) {
    return NextResponse.json(
      { error: "Site name is required.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const updated = await prisma.site.update({
    where: { id: site.id },
    data: { name, address },
  })
  return NextResponse.json({
    site: { id: updated.id, name: updated.name, address: updated.address },
  })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  const site = await findSite(actor.organizationId, id)
  if (!site) return notFound("Site")

  await prisma.site.delete({ where: { id: site.id } })
  return new NextResponse(null, { status: 204 })
}
