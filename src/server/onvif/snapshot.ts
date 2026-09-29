import { createHash, randomBytes } from "node:crypto"
import { OnvifError, mapOnvifError } from "@/server/onvif/errors"
import { getSnapshotUri } from "@/server/onvif/service"
import { openCamera } from "@/server/onvif/session"

function md5(value: string) {
  return createHash("md5").update(value).digest("hex")
}

function digestHeader(wwwAuthenticate: string, method: string, uri: string, username: string, password: string) {
  const fields = new Map<string, string>()
  for (const part of wwwAuthenticate.replace(/^Digest\s+/i, "").split(",")) {
    const match = part.trim().match(/^(\w+)=(?:"([^"]*)"|([^\s,]+))$/)
    if (match) fields.set(match[1], match[2] ?? match[3] ?? "")
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

async function downloadImage(uri: string, username: string, password: string) {
  const url = new URL(uri)
  const requestUri = `${url.pathname}${url.search}`
  const user = decodeURIComponent(url.username || username)
  const pass = decodeURIComponent(url.password || password)
  url.username = ""
  url.password = ""

  const first = await fetch(url, { signal: AbortSignal.timeout(10000), redirect: "manual" })
  if (first.ok && (first.headers.get("content-type") ?? "").startsWith("image/")) {
    return Buffer.from(await first.arrayBuffer())
  }

  const challenge = first.headers.get("www-authenticate") ?? ""
  const authorization = challenge.toLowerCase().startsWith("digest ")
    ? digestHeader(challenge, "GET", requestUri, user, pass)
    : `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`

  const second = await fetch(url, {
    headers: { Authorization: authorization },
    signal: AbortSignal.timeout(10000),
  })
  const type = second.headers.get("content-type") ?? ""
  if (!second.ok || !type.startsWith("image/")) {
    if (second.status === 401) {
      throw new OnvifError("ONVIF_AUTH_FAILED", "The camera rejected the snapshot credentials.")
    }
    throw new OnvifError("ONVIF_REQUEST_FAILED", "The camera did not return a snapshot image.")
  }
  return Buffer.from(await second.arrayBuffer())
}

export async function fetchCameraSnapshot(input: {
  id: string
  ipAddress: string
  onvifPort: number
  username: string
  password: string
}) {
  try {
    const connected = await openCamera(input)
    const uri = await getSnapshotUri(connected)
    if (!uri) {
      throw new OnvifError(
        "ONVIF_UNSUPPORTED_OPERATION",
        "This camera does not provide a snapshot.",
      )
    }
    return downloadImage(uri, input.username, input.password)
  } catch (error) {
    throw mapOnvifError(error)
  }
}
