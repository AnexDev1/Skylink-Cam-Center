"use client"

import { useEffect, useRef } from "react"
import type { EventDto } from "@/server/events/types"

export function useAlertStream(handlers: {
  onSnapshot: (unread: number) => void
  onAlert: (event: EventDto) => void
  onAcknowledged: (id: string) => void
}) {
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    const source = new EventSource("/api/events/stream")
    source.addEventListener("snapshot", (message) => {
      const body = JSON.parse((message as MessageEvent<string>).data) as { unread: number }
      handlersRef.current.onSnapshot(body.unread)
    })
    source.addEventListener("alert", (message) => {
      handlersRef.current.onAlert(JSON.parse((message as MessageEvent<string>).data) as EventDto)
    })
    source.addEventListener("acknowledged", (message) => {
      const body = JSON.parse((message as MessageEvent<string>).data) as { id: string }
      handlersRef.current.onAcknowledged(body.id)
    })
    return () => source.close()
  }, [])
}
