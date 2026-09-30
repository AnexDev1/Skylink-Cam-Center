import net from "node:net"
import { decrypt } from "@/lib/crypto"
import { prisma } from "@/server/db"
import { saveCameraState } from "@/server/cameras"
import { recordEvent } from "@/server/events/record"
import { openCamera } from "@/server/onvif/session"
import { subscribeToEvents } from "@/server/onvif/service"

const INTERVAL_MS = 60_000
const PROBE_MS = 3_000

const globalForMonitor = globalThis as {
  skylinkMonitor?: { stop: () => void }
}

const subscriptions = new Map<string, () => Promise<void>>()
const unsupported = new Set<string>()

function probe(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port })
    const finish = (online: boolean) => {
      socket.destroy()
      resolve(online)
    }
    socket.setTimeout(PROBE_MS)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
  })
}

function eventTypeForTopic(topic: string) {
  const value = topic.toLowerCase()
  if (value.includes("tamper")) return "TAMPER" as const
  if (value.includes("motion")) return "MOTION" as const
  return null
}

async function watchOnvif(camera: {
  id: string
  name: string
  ipAddress: string
  onvifPort: number
  username: string
  encryptedPassword: string
  site: { organizationId: string }
}) {
  if (subscriptions.has(camera.id) || unsupported.has(camera.id)) return
  try {
    const connected = await openCamera({
      id: camera.id,
      ipAddress: camera.ipAddress,
      onvifPort: camera.onvifPort,
      username: camera.username,
      password: decrypt(camera.encryptedPassword),
    })
    const subscription = subscribeToEvents(connected, (notification) => {
      const type = eventTypeForTopic(notification.topic)
      if (!type) return
      void recordEvent({
        organizationId: camera.site.organizationId,
        cameraId: camera.id,
        type,
        message: type === "MOTION" ? "Motion detected." : "Tamper alarm.",
      })
    })
    if (!subscription.supported) {
      unsupported.add(camera.id)
      return
    }
    subscriptions.set(camera.id, subscription.stop)
  } catch {
    // The next status pass retries cameras that failed to subscribe.
  }
}

async function stopWatch(cameraId: string) {
  const stop = subscriptions.get(cameraId)
  subscriptions.delete(cameraId)
  if (stop) await stop().catch(() => undefined)
}

async function checkCameras() {
  const cameras = await prisma.camera.findMany({
    include: { site: { select: { organizationId: true } } },
  })

  await Promise.all(
    cameras.map(async (camera) => {
      const online = await probe(camera.ipAddress, camera.onvifPort)
      const next = online ? "ONLINE" : "OFFLINE"
      if (next !== camera.status) {
        await saveCameraState(camera.id, camera.status, {
          status: next,
          lastSeenAt: online ? new Date() : camera.lastSeenAt ?? undefined,
        })
        await recordEvent({
          organizationId: camera.site.organizationId,
          cameraId: camera.id,
          type: next,
          message: online
            ? `${camera.name} is reachable.`
            : `${camera.name} stopped responding.`,
        })
      } else if (online && camera.status === "ONLINE") {
        await prisma.camera.update({
          where: { id: camera.id },
          data: { lastSeenAt: new Date() },
        })
      }

      if (online && camera.protocol !== "ISAPI") void watchOnvif(camera)
      else {
        unsupported.delete(camera.id)
        await stopWatch(camera.id)
      }
    }),
  )
}

export function startMonitoring() {
  if (globalForMonitor.skylinkMonitor) return
  const timer = setInterval(() => {
    void checkCameras().catch((error: unknown) => {
      console.error("Camera status check failed", error)
    })
  }, INTERVAL_MS)
  timer.unref?.()
  globalForMonitor.skylinkMonitor = {
    stop() {
      clearInterval(timer)
      globalForMonitor.skylinkMonitor = undefined
    },
  }
  void checkCameras().catch((error: unknown) => {
    console.error("Camera status check failed", error)
  })
}
