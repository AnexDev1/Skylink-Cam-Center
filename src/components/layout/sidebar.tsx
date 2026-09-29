"use client"

import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Logo } from "@/components/brand/logo"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { isNavActive, navItems } from "@/lib/navigation"
import { cn } from "cn"

type SidebarProps = {
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
  onNavigate: () => void
}

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 flex flex-col bg-sl-gradient text-white shadow-xl transition-[width,transform] duration-200",
        collapsed ? "w-[4.5rem]" : "w-64",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}
    >
      <div
        className={cn(
          "flex h-16 items-center gap-3 border-b border-white/15 px-3",
          collapsed && "justify-center px-2",
        )}
      >
        <Logo variant="white" />
        {!collapsed && (
          <div className="min-w-0 leading-none">
            <p className="truncate text-sm font-bold tracking-tight">
              CamCenter
            </p>
            <p className="mt-1 text-[0.62rem] font-medium tracking-[0.16em] text-white/70 uppercase">
              Skylink
            </p>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2" aria-label="Primary">
        {navItems.map((item) => {
          const active = isNavActive(pathname, item.href)
          const Icon = item.icon
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white",
                collapsed && "justify-center px-0",
                active &&
                  "bg-sl-gradient text-white shadow-md ring-1 ring-white/45",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )

          if (!collapsed) return <div key={item.href}>{link}</div>

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={link} />
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          )
        })}
      </nav>

      <div className="border-t border-white/15 p-2">
        <Button
          variant="ghost"
          className={cn(
            "w-full text-white hover:bg-white/10 hover:text-white",
            collapsed ? "justify-center" : "justify-start",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={onToggleCollapsed}
        >
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          {!collapsed && <span>Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}
