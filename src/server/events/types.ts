import type { EventType } from "@/generated/prisma/client"

export type EventDto = {
  id: string
  cameraId: string
  cameraName: string
  siteId: string
  type: EventType
  message: string
  createdAt: string
  acknowledged: boolean
}

export function toEventDto(event: {
  id: string
  cameraId: string
  type: EventType
  message: string
  createdAt: Date
  acknowledged: boolean
  camera: { name: string; siteId: string }
}): EventDto {
  return {
    id: event.id,
    cameraId: event.cameraId,
    cameraName: event.camera.name,
    siteId: event.camera.siteId,
    type: event.type,
    message: event.message,
    createdAt: event.createdAt.toISOString(),
    acknowledged: event.acknowledged,
  }
}
