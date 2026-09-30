import { redirect } from "next/navigation"
import { UsersManager } from "@/components/users/users-manager"
import { prisma } from "@/server/db"
import { canManage, loadActor } from "@/server/access"

export default async function UsersPage() {
  const actor = await loadActor()
  if (!actor) redirect("/login")
  if (!canManage(actor.role)) redirect("/dashboard")

  const [users, sites] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      include: { siteAccess: { select: { siteId: true } } },
    }),
    prisma.site.findMany({
      where: { organizationId: actor.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ])

  return (
    <UsersManager
      currentUserId={actor.id}
      sites={sites}
      initialUsers={users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        siteIds: user.siteAccess.map((access) => access.siteId),
      }))}
    />
  )
}
