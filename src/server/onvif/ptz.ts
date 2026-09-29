import type { Cam as OnvifCam } from "onvif"
import { mapOnvifError, OnvifError } from "@/server/onvif/errors"
import { openCamera } from "@/server/onvif/session"

const SPEED = 0.5
const MOVE_TIMEOUT_MS = 1200

export const ptzDirections = [
  "up",
  "down",
  "left",
  "right",
  "up-left",
  "up-right",
  "down-left",
  "down-right",
  "zoom-in",
  "zoom-out",
] as const

export type PtzDirection = (typeof ptzDirections)[number]

const vectors: Record<
  PtzDirection,
  {
    x?: number
    y?: number
    zoom?: number
    onlySendPanTilt?: boolean
    onlySendZoom?: boolean
  }
> = {
  up: { x: 0, y: SPEED, onlySendPanTilt: true },
  down: { x: 0, y: -SPEED, onlySendPanTilt: true },
  left: { x: -SPEED, y: 0, onlySendPanTilt: true },
  right: { x: SPEED, y: 0, onlySendPanTilt: true },
  "up-left": { x: -SPEED, y: SPEED, onlySendPanTilt: true },
  "up-right": { x: SPEED, y: SPEED, onlySendPanTilt: true },
  "down-left": { x: -SPEED, y: -SPEED, onlySendPanTilt: true },
  "down-right": { x: SPEED, y: -SPEED, onlySendPanTilt: true },
  "zoom-in": { zoom: SPEED, onlySendZoom: true },
  "zoom-out": { zoom: -SPEED, onlySendZoom: true },
}

function callPtz(cam: OnvifCam, run: (callback: (error: Error | null) => void) => void) {
  return new Promise<void>((resolve, reject) => {
    run((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

async function withPtz(
  input: {
    id: string
    ipAddress: string
    onvifPort: number
    username: string
    password: string
    ptzSupported: boolean
  },
  run: (cam: OnvifCam) => Promise<void>,
) {
  if (!input.ptzSupported) {
    throw new OnvifError(
      "ONVIF_UNSUPPORTED_OPERATION",
      "This camera does not support PTZ.",
    )
  }
  try {
    const connected = await openCamera(input)
    if (!connected.ptz) {
      throw new OnvifError(
        "ONVIF_UNSUPPORTED_OPERATION",
        "This camera does not support PTZ.",
      )
    }
    await run(connected.cam)
  } catch (error) {
    throw mapOnvifError(error)
  }
}

export function moveCamera(
  input: Parameters<typeof withPtz>[0],
  direction: PtzDirection,
) {
  const vector = vectors[direction]
  return withPtz(input, (cam) =>
    callPtz(cam, (callback) => {
      cam.continuousMove({ ...vector, timeout: MOVE_TIMEOUT_MS }, callback)
    }),
  )
}

export function stopCamera(input: Parameters<typeof withPtz>[0]) {
  return withPtz(input, (cam) =>
    callPtz(cam, (callback) => {
      cam.stop({ panTilt: true, zoom: true }, callback)
    }),
  )
}

export function homeCamera(input: Parameters<typeof withPtz>[0]) {
  return withPtz(input, (cam) =>
    callPtz(cam, (callback) => {
      cam.gotoHomePosition({}, callback)
    }),
  )
}
