import { NextResponse } from "next/server"
import { prisma } from "@/server/db"
import { hashPassword } from "@/lib/password"
import { authorize, notFound } from "@/server/access"
import { roles, type Role } from "@/types/auth"

export const runtime = "nodejs"

function isRole(value: string): value is Role {
  return roles.includes(value as Role)
}

async function findUser(organizationId: string, id: string) {
  return prisma.user.findFirst({
    where: { id, organizationId },
    select: { id: true, role: true, email: true },
  })
}

async function lastAdmin(organizationId: string, userId: string) {
  const admins = await prisma.user.count({
    where: { organizationId, role: "ADMIN", NOT: { id: userId } },
  })
  return admins === 0
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  const user = await findUser(actor.organizationId, id)
  if (!user) return notFound("User")

  const body = (await request.json().catch(() => null)) as {
    name?: string
    role?: string
    password?: string
    siteIds?: string[]
  } | null
  const name = body?.name?.trim() ?? ""
  const role = body?.role ?? ""
  const password = body?.password ?? ""
  const siteIds = Array.isArray(body?.siteIds) ? [...new Set(body.siteIds)] : []

  if (!name || !isRole(role)) {
    return NextResponse.json(
      { error: "Name and role are required.", code: "VALIDATION" },
      { status: 400 },
    )
  }
  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters.", code: "VALIDATION" },
      { status: 400 },
    )
  }
  if (user.role === "ADMIN" && role !== "ADMIN" && (await lastAdmin(actor.organizationId, user.id))) {
    return NextResponse.json(
      { error: "The organization needs at least one admin.", code: "LAST_ADMIN" },
      { status: 409 },
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

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: {
        name,
        role,
        ...(password ? { passwordHash: await hashPassword(password) } : {}),
      },
    }),
    prisma.siteAccess.deleteMany({ where: { userId: user.id } }),
    prisma.siteAccess.createMany({
      data: siteIds.map((siteId) => ({ userId: user.id, siteId })),
    }),
  ])

  return NextResponse.json({
    user: { id: user.id, name, email: user.email, role, siteIds },
  })
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("manage")
  if (!actor) return response

  const { id } = await context.params
  if (id === actor.id) {
    return NextResponse.json(
      { error: "You cannot remove your own account.", code: "SELF" },
      { status: 409 },
    )
  }

  const user = await findUser(actor.organizationId, id)
  if (!user) return notFound("User")
  if (user.role === "ADMIN" && (await lastAdmin(actor.organizationId, user.id))) {
    return NextResponse.json(
      { error: "The organization needs at least one admin.", code: "LAST_ADMIN" },
      { status: 409 },
    )
  }

  await prisma.user.delete({ where: { id: user.id } })
  return new NextResponse(null, { status: 204 })
}
