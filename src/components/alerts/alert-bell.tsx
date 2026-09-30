"use client"

import { Bell } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { useAlertStream } from "@/components/alerts/use-alert-stream"

export function AlertBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread)

  useAlertStream({
    onSnapshot: setUnread,
    onAlert: (event) => {
      if (!event.acknowledged) setUnread((count) => count + 1)
    },
    onAcknowledged: () => setUnread((count) => Math.max(0, count - 1)),
  })

  const label = unread === 0 ? "No unacknowledged alerts" : `${unread} unacknowledged alerts`

  return (
    <Link
      href="/dashboard/alerts"
      aria-label={label}
      className="relative inline-flex size-8 items-center justify-center rounded-lg text-sl-text hover:bg-muted"
    >
      <Bell className="size-4" />
      {unread > 0 ? (
        <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-sl-danger px-1 text-[0.65rem] font-semibold text-white">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </Link>
  )
}
