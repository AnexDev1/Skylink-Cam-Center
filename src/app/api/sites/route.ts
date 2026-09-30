import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { authorize } from "@/server/access"

export const runtime = "nodejs"

export async function GET() {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const sites = await prisma.site.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { name: "asc" },
    include: {
      cameras: { orderBy: { name: "asc" }, select: { id: true, name: true } },
    },
  })

  return NextResponse.json({
    sites: sites.map((site) => ({
      id: site.id,
      name: site.name,
      address: site.address,
      cameras: site.cameras,
    })),
  })
}

export async function POST(request: Request) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

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

  const site = await prisma.site.create({
    data: { name, address, organizationId: actor.organizationId },
  })
  return NextResponse.json(
    { site: { id: site.id, name: site.name, address: site.address, cameras: [] } },
    { status: 201 },
  )
}
