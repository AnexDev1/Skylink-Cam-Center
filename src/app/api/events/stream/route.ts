import { prisma } from "@/server/db"
import { accessibleSiteWhere, authorize } from "@/server/access"
import { subscribeToAlerts } from "@/server/events/bus"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const { actor, response } = await authorize("view")
  if (!actor) return response

  const siteWhere = await accessibleSiteWhere(actor)
  const [unread, sites] = await Promise.all([
    prisma.event.count({
      where: {
        acknowledged: false,
        camera: { site: siteWhere },
      },
    }),
    actor.role === "ADMIN"
      ? Promise.resolve(null)
      : prisma.site.findMany({
          where: siteWhere,
          select: { id: true },
        }),
  ])

  let unsubscribe = () => {}
  let heartbeat: ReturnType<typeof setInterval> | undefined
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk))
        } catch {
          unsubscribe()
        }
      }
      send(`event: snapshot\ndata: ${JSON.stringify({ unread })}\n\n`)
      unsubscribe = subscribeToAlerts(
        actor.organizationId,
        sites?.map((site) => site.id) ?? null,
        send,
      )
      heartbeat = setInterval(() => send(": keepalive\n\n"), 20_000)
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat)
      unsubscribe()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
