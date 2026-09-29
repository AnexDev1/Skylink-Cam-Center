import { redirect } from "next/navigation"
import { AppShell } from "@/components/layout/app-shell"
import { auth } from "@/auth"

export default async function DashboardLayout({
  children,
}: LayoutProps<"/dashboard">) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <AppShell user={session.user}>{children}</AppShell>
}
