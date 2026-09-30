import { createHash, randomBytes } from "node:crypto"
import net from "node:net"
import { DeviceError } from "@/server/hikvision/errors"

const TIMEOUT_MS = 8000

function md5(value: string) {
  return createHash("md5").update(value).digest("hex")
}

function digestHeader(
  wwwAuthenticate: string,
  method: string,
  uri: string,
  username: string,
  password: string,
) {
  const fields = new Map<string, string>()
  for (const part of wwwAuthenticate.replace(/^Digest\s+/i, "").split(",")) {
    const match = part.trim().match(/^([a-zA-Z]+)=(?:"([^"]*)"|([^\s,]+))$/)
    if (match) fields.set(match[1].toLowerCase(), match[2] ?? match[3] ?? "")
  }
  const realm = fields.get("realm") ?? ""
  const nonce = fields.get("nonce") ?? ""
  const qop = fields.get("qop")?.split(",")[0]?.trim()
  const nc = "00000001"
  const cnonce = randomBytes(8).toString("hex")
  const ha1 = md5(`${username}:${realm}:${password}`)
  const ha2 = md5(`${method}:${uri}`)
  const response = qop
    ? md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    : md5(`${ha1}:${nonce}:${ha2}`)
  const pieces = [
    `username="${username}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
  ]
  if (qop) pieces.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`)
  const opaque = fields.get("opaque")
  if (opaque) pieces.push(`opaque="${opaque}"`)
  return `Digest ${pieces.join(", ")}`
}

export function hikvisionStreamId(channel: number) {
  // Sub-stream. The main stream on this recorder is 1440p H.265, which is too heavy to convert for the browser.
  return channel * 100 + 2
}

export function hikvisionRtspUrl(ipAddress: string, rtspPort: number, channel: number) {
  return `rtsp://${ipAddress}:${rtspPort}/Streaming/Channels/${hikvisionStreamId(channel)}`
}

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}[^>]*>([^<]*)<\\/${name}>`, "i"))
  return match?.[1]?.trim() ?? ""
}

function probePort(host: string, port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect({ host, port })
    const finish = (open: boolean) => {
      socket.destroy()
      resolve(open)
    }
    socket.setTimeout(3000)
    socket.once("connect", () => finish(true))
    socket.once("timeout", () => finish(false))
    socket.once("error", () => finish(false))
  })
}

async function digestSend(
  method: string,
  url: URL,
  username: string,
  password: string,
  body?: string,
) {
  const uri = `${url.pathname}${url.search}`
  const headers: Record<string, string> = {}
  if (body) headers["Content-Type"] = "application/xml"
  let first: Response
  try {
    first = await fetch(url, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "manual",
    })
  } catch (error) {
    throw new DeviceError(
      "UNREACHABLE",
      "The recorder did not respond. Check the IP address, HTTP port, and that this computer is on the same network.",
      { cause: error },
    )
  }

  if (first.status === 404) {
    throw new DeviceError(
      "ISAPI_DISABLED",
      "This recorder did not serve ISAPI. In System Service, turn ISAPI on and leave HTTP enabled.",
    )
  }
  if (first.ok || first.status === 403) return first

  const challenge = first.headers.get("www-authenticate") ?? ""
  if (first.status !== 401 || !challenge.toLowerCase().startsWith("digest ")) {
    throw new DeviceError(
      "ISAPI_DISABLED",
      "This recorder refused the ISAPI request. In System Service, turn ISAPI on and leave HTTP enabled.",
    )
  }

  let second: Response
  try {
    second = await fetch(url, {
      method,
      headers: {
        ...headers,
        Authorization: digestHeader(challenge, method, uri, username, password),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch (error) {
    throw new DeviceError(
      "UNREACHABLE",
      "The recorder did not respond. Check the IP address, HTTP port, and that this computer is on the same network.",
      { cause: error },
    )
  }

  if (second.status === 401) {
    throw new DeviceError("AUTH_FAILED", "The recorder rejected the username or password.")
  }
  if (second.status === 404) {
    throw new DeviceError(
      "ISAPI_DISABLED",
      "This recorder did not serve ISAPI. In System Service, turn ISAPI on and leave HTTP enabled.",
    )
  }
  return second
}

async function digestGet(url: URL, username: string, password: string) {
  return digestSend("GET", url, username, password)
}

async function useBrowserCodec(input: {
  ipAddress: string
  onvifPort: number
  channel: number
  username: string
  password: string
}) {
  const url = new URL(
    `http://${input.ipAddress}:${input.onvifPort}/ISAPI/Streaming/channels/${hikvisionStreamId(input.channel)}`,
  )
  const current = await digestGet(url, input.username, input.password)
  const xml = await current.text()
  if (!current.ok || /<videoCodecType>\s*H\.?264\s*<\/videoCodecType>/i.test(xml)) return
  if (!/<videoCodecType>/i.test(xml)) return

  const next = xml
    .replace(/<videoCodecType>[^<]*<\/videoCodecType>/i, "<videoCodecType>H.264</videoCodecType>")
    .replace(/<GovLength>\d+<\/GovLength>/i, "<GovLength>20</GovLength>")
  const saved = await digestSend("PUT", url, input.username, input.password, next)
  if (!saved.ok) return
  await restartLiveVideo(input)
}

export async function restartLiveVideo(input: {
  ipAddress: string
  onvifPort: number
  channel: number
  username: string
  password: string
}) {
  const url = new URL(
    `http://${input.ipAddress}:${input.onvifPort}/ISAPI/Streaming/channels/${hikvisionStreamId(input.channel)}`,
  )
  const current = await digestGet(url, input.username, input.password)
  const xml = await current.text()
  if (!current.ok) return
  const videoEnabled = /(<Video>[\s\S]*?<enabled>)(?:true|false)(<\/enabled>)/i
  if (!videoEnabled.test(xml)) return
  const off = xml.replace(videoEnabled, "$1false$2")
  await digestSend("PUT", url, input.username, input.password, off)
  await new Promise((resolve) => setTimeout(resolve, 500))
  const on = xml.replace(videoEnabled, "$1true$2")
  await digestSend("PUT", url, input.username, input.password, on)
}

export async function connectHikvision(input: {
  ipAddress: string
  onvifPort: number
  rtspPort: number
  channel: number
  username: string
  password: string
}) {
  const infoUrl = new URL(
    `http://${input.ipAddress}:${input.onvifPort}/ISAPI/System/deviceInfo`,
  )
  const info = await digestGet(infoUrl, input.username, input.password)
  const body = await info.text()
  if (!info.ok || (!body.includes("<deviceName") && !body.includes("<model"))) {
    throw new DeviceError(
      "ISAPI_DISABLED",
      "This recorder did not return ISAPI device information. In System Service, turn ISAPI on and leave HTTP enabled.",
    )
  }

  const streamId = hikvisionStreamId(input.channel)
  const channelUrl = new URL(
    `http://${input.ipAddress}:${input.onvifPort}/ISAPI/Streaming/channels/${streamId}`,
  )
  const channelResponse = await digestGet(channelUrl, input.username, input.password)
  await channelResponse.body?.cancel().catch(() => undefined)
  if (channelResponse.status === 404) {
    throw new DeviceError(
      "ISAPI_DISABLED",
      `Channel ${input.channel} is not available on this recorder.`,
    )
  }
  // The browser can play H.264 directly. The main stream stays H.265 for recording.
  await useBrowserCodec(input)

  const rtspOpen = await probePort(input.ipAddress, input.rtspPort)
  if (!rtspOpen) {
    throw new DeviceError(
      "RTSP_UNREACHABLE",
      `ISAPI accepted the login, but RTSP port ${input.rtspPort} did not accept a connection.`,
    )
  }

  return {
    manufacturer: tag(body, "manufacturer") || "Hikvision",
    model: tag(body, "model") || tag(body, "deviceName") || "Hikvision",
    firmware: tag(body, "firmwareVersion"),
    ptz: false,
    streamUri: hikvisionRtspUrl(input.ipAddress, input.rtspPort, input.channel),
  }
}

export async function fetchHikvisionSnapshot(input: {
  ipAddress: string
  onvifPort: number
  channel: number
  username: string
  password: string
}) {
  const url = new URL(
    `http://${input.ipAddress}:${input.onvifPort}/ISAPI/Streaming/channels/${hikvisionStreamId(input.channel)}/picture`,
  )
  const response = await digestGet(url, input.username, input.password)
  const type = response.headers.get("content-type") ?? ""
  if (!response.ok || !type.startsWith("image/")) {
    throw new DeviceError("ISAPI_DISABLED", "The recorder did not return a snapshot for this channel.")
  }
  return Buffer.from(await response.arrayBuffer())
}
