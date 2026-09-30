import { Cam, Discovery, type Cam as OnvifCam } from "onvif"
import { mapOnvifError } from "@/server/onvif/errors"

const CONNECT_TIMEOUT_MS = 8000
const DISCOVERY_TIMEOUT_MS = 4000

export type DiscoveredCamera = {
  ip: string
  port: number
  xaddr: string
  name: string | null
  hardware: string | null
  scopes: string
}

export type ConnectedCamera = {
  ip: string
  port: number
  manufacturer: string
  model: string
  firmware: string
  streamUri: string | null
  ptz: boolean
  cam: OnvifCam
}

export type OnvifNotification = {
  topic: string
  time?: string
  source?: unknown
  data?: unknown
}

export type EventSubscription = {
  supported: boolean
  stop: () => Promise<void>
}

type ProbeMatch = {
  probeMatches?: {
    probeMatch?: {
      XAddrs?: string
      scopes?: string
    }
  }
}

function callCamera<T>(
  run: (callback: (error: Error | null, data?: T) => void) => void,
) {
  return new Promise<T>((resolve, reject) => {
    run((error, data) => {
      if (error) reject(error)
      else resolve(data as T)
    })
  })
}

function scopeValue(scopes: string | undefined, key: string) {
  if (!scopes) return null
  const token = `/${key}/`
  const match = scopes
    .split(/\s+/)
    .find((scope) => scope.includes(token))
  if (!match) return null
  const value = match.slice(match.indexOf(token) + token.length)
  return decodeURIComponent(value) || null
}

function parseProbe(device: unknown, reportedAddress?: string): DiscoveredCamera | null {
  const match = device as ProbeMatch
  const probe = match.probeMatches?.probeMatch
  const xaddrs = probe?.XAddrs?.split(/\s+/).filter(Boolean) ?? []
  const xaddr = xaddrs[0]
  if (!xaddr) return null

  let url: URL
  try {
    url = new URL(xaddr)
  } catch {
    return null
  }

  const port = url.port
    ? Number(url.port)
    : url.protocol === "https:"
      ? 443
      : 80

  return {
    ip: reportedAddress || url.hostname,
    port,
    xaddr,
    name: scopeValue(probe?.scopes, "name"),
    hardware: scopeValue(probe?.scopes, "hardware"),
    scopes: probe?.scopes ?? "",
  }
}

export async function discoverCameras() {
  const found = new Map<string, DiscoveredCamera>()

  const onDevice = (
    device: unknown,
    remote?: { address?: string },
  ) => {
    const parsed = parseProbe(device, remote?.address)
    if (!parsed) return
    found.set(`${parsed.ip}:${parsed.port}`, parsed)
  }

  Discovery.on("device", onDevice)

  try {
    await new Promise<void>((resolve, reject) => {
      Discovery.probe(
        { timeout: DISCOVERY_TIMEOUT_MS, resolve: false },
        (error, devices) => {
          for (const device of devices ?? []) {
            const parsed = parseProbe(device)
            if (parsed) found.set(`${parsed.ip}:${parsed.port}`, parsed)
          }
          if (found.size > 0) {
            resolve()
            return
          }
          if (error) reject(Array.isArray(error) ? error[0] : error)
          else resolve()
        },
      )
    })
  } catch (error) {
    throw mapOnvifError(error)
  } finally {
    Discovery.removeListener("device", onDevice)
  }

  return [...found.values()]
}

export async function connectToCamera(
  ip: string,
  port: number,
  username: string,
  password: string,
): Promise<ConnectedCamera> {
  try {
    const cam = await new Promise<OnvifCam>((resolve, reject) => {
      const next = new Cam(
        {
          hostname: ip,
          port,
          username,
          password,
          timeout: CONNECT_TIMEOUT_MS,
          preserveAddress: true,
        },
        (error) => {
          if (error) reject(error)
          else resolve(next)
        },
      )
    })

    const information = await callCamera<OnvifCam["deviceInformation"]>((callback) => {
      cam.getDeviceInformation(callback)
    })

    let streamUri: string | null = null
    try {
      const stream = await callCamera<{ uri: string }>((callback) => {
        cam.getStreamUri(
          {
            protocol: "RTSP",
            profileToken: cam.defaultProfile?.token,
          },
          callback,
        )
      })
      streamUri = stream?.uri ?? null
    } catch (error) {
      const mapped = mapOnvifError(error)
      if (mapped.code !== "ONVIF_UNSUPPORTED_OPERATION") throw error
    }

    return {
      ip,
      port,
      manufacturer: information?.manufacturer || "Unknown",
      model: information?.model || "Unknown",
      firmware: information?.firmwareVersion || "",
      streamUri,
      ptz: Boolean(cam.capabilities?.PTZ),
      cam,
    }
  } catch (error) {
    throw mapOnvifError(error)
  }
}

export async function getSnapshotUri(camera: ConnectedCamera) {
  try {
    const snapshot = await callCamera<{ uri: string }>((callback) => {
      camera.cam.getSnapshotUri(
        { profileToken: camera.cam.defaultProfile?.token },
        callback,
      )
    })
    return snapshot?.uri ?? null
  } catch (error) {
    const mapped = mapOnvifError(error)
    if (mapped.code === "ONVIF_UNSUPPORTED_OPERATION") return null
    throw mapped
  }
}

export function subscribeToEvents(
  camera: ConnectedCamera,
  onEvent: (event: OnvifNotification) => void,
): EventSubscription {
  if (!camera.cam.capabilities?.events) {
    return { supported: false, async stop() {} }
  }

  const onMessage = (message: {
    topic?: { _?: string } | string
    time?: string
    message?: { source?: unknown; data?: unknown }
  }) => {
    const topic =
      typeof message.topic === "string"
        ? message.topic
        : (message.topic?._ ?? "event")
    onEvent({
      topic,
      time: message.time,
      source: message.message?.source,
      data: message.message?.data,
    })
  }

  const onFailure = (error: unknown) => {
    const mapped = mapOnvifError(error)
    if (mapped.code === "ONVIF_UNSUPPORTED_OPERATION") return
    onEvent({
      topic: "error",
      data: { code: mapped.code, message: mapped.message },
    })
  }

  try {
    camera.cam.on("event", onMessage)
    camera.cam.on("eventsError", onFailure)
  } catch (error) {
    const mapped = mapOnvifError(error)
    if (mapped.code === "ONVIF_UNSUPPORTED_OPERATION") {
      return { supported: false, async stop() {} }
    }
    throw mapped
  }

  return {
    supported: true,
    stop() {
      camera.cam.removeListener("event", onMessage)
      camera.cam.removeListener("eventsError", onFailure)
      return new Promise((resolve) => {
        camera.cam.unsubscribe(() => resolve())
      })
    },
  }
}
