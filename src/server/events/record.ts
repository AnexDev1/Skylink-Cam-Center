import type { EventType } from "@/generated/prisma/client"
import { prisma } from "@/server/db"
import { publishAlert } from "@/server/events/bus"
import { toEventDto } from "@/server/events/types"

const REPEAT_MS = 15_000
const recent = new Map<string, number>()

export async function recordEvent(input: {
  organizationId: string
  cameraId: string
  type: EventType
  message: string
}) {
  if (input.type === "MOTION" || input.type === "TAMPER") {
    const key = `${input.cameraId}:${input.type}`
    const now = Date.now()
    if (now - (recent.get(key) ?? 0) < REPEAT_MS) return null
    recent.set(key, now)
  }

  const created = await prisma.event.create({
    data: {
      cameraId: input.cameraId,
      type: input.type,
      message: input.message,
    },
    include: { camera: { select: { name: true, siteId: true } } },
  })
  const dto = toEventDto(created)
  publishAlert(input.organizationId, dto)
  return dto
}
