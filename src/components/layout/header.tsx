"use client"

import { Menu } from "lucide-react"
import { Logo } from "@/components/brand/logo"
import { Wordmark } from "@/components/brand/wordmark"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { signOutAction } from "@/server/auth-actions"
import type { SessionUser } from "@/types/auth"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type HeaderProps = {
  user: SessionUser
  onOpenMobileNav: () => void
}

function initials(name?: string | null) {
  const parts = (name ?? "Skylink").split(" ").filter(Boolean)
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function Header({ user, onOpenMobileNav }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-sl-surface px-4">
      <Button
        variant="outline"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onOpenMobileNav}
      >
        <Menu />
      </Button>

      <div className="flex min-w-0 items-center gap-2.5">
        <Logo />
        <Wordmark />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="Open account menu"
          >
            <Avatar>
              <AvatarFallback className="bg-sl-gradient text-xs font-semibold text-white">
                {initials(user.name)}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="block text-sm font-semibold text-foreground">
                  {user.name}
                </span>
                <span className="block text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
                <span className="mt-1 block text-[0.65rem] font-semibold tracking-wide text-sl-primary uppercase">
                  {user.role}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center rounded-md px-1.5 py-1 text-left text-sm outline-none hover:bg-accent hover:text-accent-foreground"
              >
                Sign out
              </button>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
