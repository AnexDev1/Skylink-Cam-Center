import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/server/db"
import type { Role } from "@/types/auth"

export type Actor = {
  id: string
  name: string
  email: string
  role: Role
  organizationId: string
}

export function canControl(role: Role) {
  return role === "ADMIN" || role === "OPERATOR"
}

export function canManage(role: Role) {
  return role === "ADMIN"
}

export function forbidden() {
  return NextResponse.json(
    { error: "You do not have permission for that action.", code: "FORBIDDEN" },
    { status: 403 },
  )
}

export async function loadActor(): Promise<Actor | null> {
  const session = await auth()
  if (!session?.user?.id) return null
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      organizationId: true,
    },
  })
  return user
}

export async function authorize(kind: "view" | "control" | "manage") {
  const actor = await loadActor()
  if (!actor) {
    return {
      actor: null,
      response: NextResponse.json(
        { error: "Sign in required.", code: "UNAUTHENTICATED" },
        { status: 401 },
      ),
    }
  }
  const allowed =
    kind === "view" ||
    (kind === "control" && canControl(actor.role)) ||
    (kind === "manage" && canManage(actor.role))
  if (!allowed) return { actor: null, response: forbidden() }
  return { actor, response: null }
}

export async function accessibleSiteWhere(actor: Actor) {
  if (actor.role === "ADMIN") {
    return { organizationId: actor.organizationId }
  }
  return {
    organizationId: actor.organizationId,
    access: { some: { userId: actor.id } },
  }
}

export async function findScopedCamera(actor: Actor, id: string) {
  return prisma.camera.findFirst({
    where: { id, site: await accessibleSiteWhere(actor) },
  })
}

export function notFound(label: string) {
  return NextResponse.json(
    { error: `${label} not found.`, code: "NOT_FOUND" },
    { status: 404 },
  )
}
