import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { hashPassword } from "@/lib/password"
import { authorize } from "@/server/access"
import { roles, type Role } from "@/types/auth"

export const runtime = "nodejs"

function isRole(value: string): value is Role {
  return roles.includes(value as Role)
}

export async function GET() {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const users = await prisma.user.findMany({
    where: { organizationId: actor.organizationId },
    orderBy: { name: "asc" },
    include: { siteAccess: { select: { siteId: true } } },
  })

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      siteIds: user.siteAccess.map((access) => access.siteId),
    })),
  })
}

export async function POST(request: Request) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const body = (await request.json().catch(() => null)) as {
    name?: string
    email?: string
    password?: string
    role?: string
    siteIds?: string[]
  } | null

  const name = body?.name?.trim() ?? ""
  const email = body?.email?.trim().toLowerCase() ?? ""
  const password = body?.password ?? ""
  const role = body?.role ?? ""
  const siteIds = Array.isArray(body?.siteIds) ? [...new Set(body.siteIds)] : []

  if (!name || !email || !password || !isRole(role)) {
    return NextResponse.json(
      { error: "Name, email, password, and role are required.", code: "VALIDATION" },
      { status: 400 },
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const sites = await prisma.site.findMany({
    where: { organizationId: actor.organizationId, id: { in: siteIds } },
    select: { id: true },
  })
  if (sites.length !== siteIds.length) {
    return NextResponse.json(
      { error: "One or more sites are not in this organization.", code: "VALIDATION" },
      { status: 400 },
    )
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return NextResponse.json(
      { error: "A user with that email already exists.", code: "DUPLICATE" },
      { status: 409 },
    )
  }

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash: await hashPassword(password),
      role,
      organizationId: actor.organizationId,
      siteAccess: { create: siteIds.map((siteId) => ({ siteId })) },
    },
  })

  return NextResponse.json(
    { user: { id: user.id, name: user.name, email: user.email, role: user.role, siteIds } },
    { status: 201 },
  )
}
