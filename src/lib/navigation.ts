import {
  Bell,
  Cctv,
  LayoutDashboard,
  Settings,
  Users,
  Video,
  type LucideIcon,
} from "lucide-react"

export type NavItem = {
  label: string
  href: string
  icon: LucideIcon
}

export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Cameras", href: "/dashboard/cameras", icon: Cctv },
  { label: "Live View", href: "/dashboard/live", icon: Video },
  { label: "Alerts", href: "/dashboard/alerts", icon: Bell },
  { label: "Users", href: "/dashboard/users", icon: Users },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
]

export function isNavActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard"
  return pathname === href || pathname.startsWith(`${href}/`)
}
