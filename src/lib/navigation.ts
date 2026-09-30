import {
  Bell,
  Building2,
  Cctv,
  LayoutDashboard,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react"
import type { Role } from "@/types/auth"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
  adminOnly?: boolean
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cameras", href: "/dashboard/cameras", icon: Cctv },
  { label: "Live View", href: "/dashboard/live", icon: Video },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { label: "Sites", href: "/dashboard/sites", icon: Building2, adminOnly: true },
  { label: "Users", href: "/dashboard/users", icon: Users, adminOnly: true },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function navForRole(role: Role) {
  return navItems.filter((item) => !item.adminOnly || role === "ADMIN")
}

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
