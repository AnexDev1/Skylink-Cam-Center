"use client"

import { Moon, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "sl-theme"

export function ThemeToggle() {
  function toggleTheme() {
    const next = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark"
    document.documentElement.classList.toggle("dark", next === "dark")
    document.documentElement.style.colorScheme = next
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <Button
      variant="outline"
      size="icon"
      aria-label="Toggle color theme"
      onClick={toggleTheme}
    >
      <Sun className="hidden dark:block" />
      <Moon className="dark:hidden" />
    </Button>
  )
}
