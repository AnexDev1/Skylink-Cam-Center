"use client"

import { useId } from "react"
import { cn } from "cn"

type LogoProps = {
  className?: string
  variant?: "gradient" | "white"
}

export function Logo({ className, variant = "gradient" }: LogoProps) {
  const gradientId = useId()
  const paint = variant === "white" ? "currentColor" : `url(#${gradientId})`

  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("size-8 shrink-0", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="4"
          y1="2"
          x2="28"
          y2="30"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="55%" stopColor="#2563A8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>
      <path
        d="M23.2 8.8C22.6 5.6 19.6 3.6 15.6 3.6c-5.2 0-8.6 2.5-8.6 6.2 0 7.8 15.6 4.6 15.6 11.6 0 3.5-3.3 6-8.5 6-4.8 0-8.1-2.1-8.8-5.4"
        fill="none"
        stroke={paint}
        strokeWidth="4.25"
        strokeLinecap="round"
      />
      <path
        d="M20.4 11.2c-.4-1.6-1.8-2.6-3.8-2.6-2.4 0-3.8 1-3.8 2.5 0 3.4 7.2 2.1 7.2 5.2 0 1.5-1.4 2.6-3.8 2.6-2.1 0-3.6-.9-4-2.3"
        fill="none"
        stroke={paint}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}
