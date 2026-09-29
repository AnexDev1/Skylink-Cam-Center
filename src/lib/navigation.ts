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
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Cameras", href: "/cameras", icon: Cctv },
  { label: "Live View", href: "/live", icon: Video },
  { label: "Alerts", href: "/alerts", icon: Bell },
  { label: "Users", href: "/users", icon: Users },
  { label: "Settings", href: "/settings", icon: Settings },
]

export function isNavActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/"
  return pathname === href || pathname.startsWith(`${href}/`)
}
