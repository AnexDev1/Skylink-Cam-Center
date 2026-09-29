"use client"

import { useState, useSyncExternalStore } from "react"
import { Header } from "@/components/layout/header"
import { Sidebar } from "@/components/layout/sidebar"
import { cn } from "cn"

const STORAGE_KEY = "sl-sidebar-collapsed"
const CHANGE_EVENT = "sl-sidebar-change"

function subscribeCollapsed(onStoreChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onStoreChange)
  return () => window.removeEventListener(CHANGE_EVENT, onStoreChange)
}

function readCollapsed() {
  return window.localStorage.getItem(STORAGE_KEY) === "true"
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    readCollapsed,
    () => false,
  )
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleCollapsed() {
    window.localStorage.setItem(STORAGE_KEY, String(!readCollapsed()))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }

  return (
    <div className="min-h-svh bg-sl-bg">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={toggleCollapsed}
        onNavigate={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-sl-primary-dark/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div
        className={cn(
          "flex min-h-svh flex-col transition-[padding] duration-200 lg:pl-64",
          collapsed && "lg:pl-[4.5rem]",
        )}
      >
        <Header onOpenMobileNav={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  )
}
