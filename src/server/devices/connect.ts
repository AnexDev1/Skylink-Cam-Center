import { connectHikvision } from "@/server/hikvision/client"
import { connectToCamera } from "@/server/onvif"

export type ConnectedDevice = {
  manufacturer: string
  model: string
  firmware: string
  ptz: boolean
  streamUri: string | null
}

export async function connectStored(input: {
  protocol: string
  ipAddress: string
  onvifPort: number
  rtspPort: number
  channel: number
  username: string
  password: string
}): Promise<ConnectedDevice> {
  if (input.protocol === "ISAPI") return connectHikvision(input)

  const connected = await connectToCamera(
    input.ipAddress,
    input.onvifPort,
    input.username,
    input.password,
  )
  return {
    manufacturer: connected.manufacturer,
    model: connected.model,
    firmware: connected.firmware,
    ptz: connected.ptz,
    streamUri: connected.streamUri,
  }
}
