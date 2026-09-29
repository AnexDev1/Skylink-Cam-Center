import { connectToCamera, type ConnectedCamera } from "@/server/onvif/service"

const SESSION_MS = 30_000

type Cached = {
  key: string
  camera: ConnectedCamera
  at: number
}

const sessions = new Map<string, Cached>()

export async function openCamera(input: {
  id: string
  ipAddress: string
  onvifPort: number
  username: string
  password: string
}) {
  const key = `${input.username}\0${input.password}`
  const cached = sessions.get(input.id)
  if (cached && cached.key === key && Date.now() - cached.at < SESSION_MS) {
    cached.at = Date.now()
    return cached.camera
  }

  const camera = await connectToCamera(
    input.ipAddress,
    input.onvifPort,
    input.username,
    input.password,
  )
  sessions.set(input.id, { key, camera, at: Date.now() })
  return camera
}

export function closeCamera(id: string) {
  sessions.delete(id)
}
