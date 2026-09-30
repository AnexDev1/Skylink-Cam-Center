import { createSocket, type Socket } from "node:dgram"
import { randomUUID } from "node:crypto"
import { networkInterfaces } from "node:os"

export type SadpDevice = {
  serial: string
  model: string
  ip: string
  httpPort: number
}

const PROBE_MS = 2500

function tag(xml: string, name: string) {
  const match = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`, "i"))
  return match?.[1]?.trim() ?? ""
}

function localAddresses() {
  const addresses: string[] = []
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address)
    }
  }
  return addresses
}

function listen(address: string) {
  const socket = createSocket({ type: "udp4", reuseAddr: true })
  return new Promise<Socket>((resolve, reject) => {
    socket.once("error", reject)
    socket.bind(0, address, () => {
      socket.off("error", reject)
      try {
        socket.setBroadcast(true)
        socket.addMembership("239.255.255.250", address)
      } catch {
        // Some interfaces cannot join the discovery group.
      }
      resolve(socket)
    })
  })
}

export async function discoverSadp() {
  const found = new Map<string, SadpDevice>()
  const probe = Buffer.from(
    `<?xml version="1.0" encoding="utf-8"?><Probe><Uuid>${randomUUID().toUpperCase()}</Uuid><Types>inquiry</Types></Probe>`,
  )
  const addresses = localAddresses()
  const sockets = (
    await Promise.all(addresses.map((address) => listen(address).catch(() => null)))
  ).filter((socket): socket is Socket => socket !== null)

  const pending = sockets.map(
    (socket) =>
      new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          socket.close()
          resolve()
        }, PROBE_MS)
        socket.on("message", (message) => {
          const xml = message.toString("utf8")
          const ip = tag(xml, "IPv4Address")
          if (!ip || ip === "0.0.0.0") return
          const httpPort = Number(tag(xml, "HttpPort") || "80")
          found.set(ip, {
            serial: tag(xml, "DeviceSN"),
            model: tag(xml, "DeviceDescription"),
            ip,
            httpPort: Number.isInteger(httpPort) ? httpPort : 80,
          })
        })
        socket.send(probe, 37020, "239.255.255.250")
        socket.send(probe, 37020, "255.255.255.255")
        socket.on("close", () => {
          clearTimeout(timer)
          resolve()
        })
      }),
  )

  await Promise.all(pending)
  return [...found.values()]
}

export function sadpMatches(device: SadpDevice, serial: string) {
  const needle = serial.toUpperCase()
  const hay = `${device.serial} ${device.model}`.toUpperCase()
  return hay.includes(needle)
}
