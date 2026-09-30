/**
 * Hik-Connect, DMSS, and EZView add a camera by scanning the label QR, which
 * carries a serial or register code (and sometimes a model). The password or
 * verification code is entered afterwards. ONVIF has no QR onboarding method,
 * so a scanned serial is matched to a camera found on the local network.
 *
 * Hikvision: https://www.hikvision.com/content/dam/hikvision/ca/how-to-document/Adding-a-device-to-hik-connect-app-by-serial-number-and-verification-code.pdf
 * Dahua DMSS "Adding by SN/QR Code": https://www.dahuasecurity.com/asset/upload/uploads/soft/20220118/DMSS-App_Users-Manual_V1.4.0.pdf
 * Uniview EZCloud scan: Setup > Network > EZCloud in the camera manual.
 */

const ipv4 =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

export type DeviceQr = {
  kind: "device" | "wifi" | "unknown"
  serial: string | null
  ip: string | null
  port: number | null
  model: string | null
  verificationCode: string | null
}

const empty = {
  serial: null,
  ip: null,
  port: null,
  model: null,
  verificationCode: null,
}

export function parseDeviceQr(raw: string): DeviceQr {
  const text = raw.trim()
  if (/^WIFI:/i.test(text)) return { kind: "wifi", ...empty }

  const hik = parseHikConnect(text)
  if (hik) return hik

  const fromUrl = addressInUrl(text)
  const serial = extractSerial(text)
  if (!serial && !fromUrl) return { kind: "unknown", ...empty }
  return {
    kind: "device",
    ...empty,
    serial,
    ip: fromUrl?.ip ?? null,
    port: fromUrl?.port ?? null,
  }
}

function parseHikConnect(text: string): DeviceQr | null {
  const match = text.match(/hik-connect\.com\/views\/qrcode\/[^\s?]+\?([^\s]+)/i)
  if (!match?.[1]) return null
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const serial = lines.find((line) => line !== lines[0] && /^[A-Za-z0-9]{8,20}$/.test(line)) ?? null
  const verificationCode =
    lines.find((line) => line !== lines[0] && line !== serial && line.length >= 6) ?? null
  return {
    kind: "device",
    ...empty,
    model: decodeURIComponent(match[1]),
    serial,
    verificationCode,
  }
}

function addressInUrl(text: string) {
  if (!/^https?:\/\//i.test(text) && !/^onvif:\/\//i.test(text)) return null
  try {
    const url = new URL(text)
    if (!ipv4.test(url.hostname)) return null
    const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80
    return { ip: url.hostname, port }
  } catch {
    return null
  }
}

function extractSerial(text: string) {
  const labeled = text.match(
    /(?:\bSN\b|Serial(?:\s*No\.?|\s*Number)?|Register\s*Code|DevSN)\s*[:=]\s*["']?([A-Za-z0-9_-]{6,40})/i,
  )
  if (labeled?.[1]) return labeled[1]

  const hik = text.toUpperCase().match(/\b([A-Z]{1,2}\d{7,8}|\d{9})\b/)
  if (hik?.[1]) return hik[1]

  if (/^[A-Za-z0-9][A-Za-z0-9_-]{5,39}$/.test(text)) return text
  return null
}
