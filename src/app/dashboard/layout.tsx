import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { toCameraDto } from "@/server/cameras"
import { prisma } from "@/server/db"
import { accessibleSiteWhere, loadActor } from "@/server/access"

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const actor = await loadActor()
  if (!actor) redirect("/login")

  const siteWhere = await accessibleSiteWhere(actor)
  const [unreadAlerts, cameras] = await Promise.all([
    prisma.event.count({
      where: {
        acknowledged: false,
        camera: { site: siteWhere },
      },
    }),
    prisma.camera.findMany({
      where: { site: siteWhere },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <AppShell user={actor} unreadAlerts={unreadAlerts} cameras={cameras.map(toCameraDto)}>
      {children}
    </AppShell>
  )
}
