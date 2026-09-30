import type { EventDto } from "@/server/events/types"

/**
 * Alerts only need to travel from the server to the browser. Server-Sent
 * Events do that over a normal HTTP response, reconnect on their own, and
 * stay inside the Next.js App Router. A WebSocket server would need a custom
 * Node server, and a hosted service would add a vendor. This in-memory fan-out
 * matches one self-hosted Node process (next dev / next start).
 */
type Subscriber = {
  organizationId: string
  siteIds: Set<string> | null
  send: (chunk: string) => void
}

const subscribers = new Set<Subscriber>()

function canSee(subscriber: Subscriber, organizationId: string, siteId: string) {
  return (
    subscriber.organizationId === organizationId &&
    (subscriber.siteIds === null || subscriber.siteIds.has(siteId))
  )
}

export function subscribeToAlerts(
  organizationId: string,
  siteIds: string[] | null,
  send: (chunk: string) => void,
) {
  const subscriber = {
    organizationId,
    siteIds: siteIds ? new Set(siteIds) : null,
    send,
  }
  subscribers.add(subscriber)
  return () => {
    subscribers.delete(subscriber)
  }
}

export function publishAlert(organizationId: string, event: EventDto) {
  const chunk = `event: alert\ndata: ${JSON.stringify(event)}\n\n`
  for (const subscriber of subscribers) {
    if (canSee(subscriber, organizationId, event.siteId)) subscriber.send(chunk)
  }
}

export function publishAcknowledged(organizationId: string, id: string, siteId: string) {
  const chunk = `event: acknowledged\ndata: ${JSON.stringify({ id })}\n\n`
  for (const subscriber of subscribers) {
    if (canSee(subscriber, organizationId, siteId)) subscriber.send(chunk)
  }
}
