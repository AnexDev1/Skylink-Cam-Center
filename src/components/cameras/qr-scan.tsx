"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { decodeQrRgba } from "@/lib/decode-qr"
import { parseDeviceQr } from "@/lib/device-qr"

export type QrDraft = {
  name: string
  ipAddress: string
  onvifPort: string
  protocol: "ONVIF" | "ISAPI"
  username: string
  password: string
  note: string
}

function draw(source: CanvasImageSource, width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  context?.drawImage(source, 0, 0, width, height)
  return canvas
}

function textFromCanvas(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context || !canvas.width || !canvas.height) return null
  const image = context.getImageData(0, 0, canvas.width, canvas.height)
  return decodeQrRgba(image.data, canvas.width, canvas.height)
}

function readQr(source: CanvasImageSource, width: number, height: number) {
  if (!width || !height) return null
  const full = draw(source, width, height)
  const views = [full]
  const cropWidth = Math.round(width * 0.7)
  const cropHeight = Math.round(height * 0.62)
  const crop = document.createElement("canvas")
  crop.width = cropWidth
  crop.height = cropHeight
  crop
    .getContext("2d", { willReadFrequently: true })
    ?.drawImage(
      full,
      Math.round(width * 0.15),
      Math.round(height * 0.18),
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    )
  views.push(crop)
  for (const canvas of views) {
    const text = textFromCanvas(canvas)
    if (text) return text
  }
  return null
}

export function QrScan({
  disabled,
  onApply,
}: {
  disabled: boolean
  onApply: (draft: QrDraft) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const [live, setLive] = useState(false)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  function stopCamera() {
    if (timerRef.current !== null) window.clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setLive(false)
  }

  async function applyPayload(payload: string) {
    if (busyRef.current) return
    busyRef.current = true
    stopCamera()
    const parsed = parseDeviceQr(payload)
    if (parsed.kind === "wifi") {
      busyRef.current = false
      setError("That QR code is a Wi-Fi setup code. Scan the QR code printed on the camera label.")
      return
    }
    if (parsed.kind === "unknown") {
      busyRef.current = false
      setError("That QR code does not look like a camera serial, register code, or address.")
      return
    }

    setBusy(true)
    setError(null)
    let matched: { ip: string; port: number; name: string } | null = null
    try {
      if (parsed.serial) {
        const response = await fetch("/api/cameras/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ serial: parsed.serial }),
        })
        if (response.ok) {
          const body = (await response.json()) as {
            device: { ip: string; port: number; name: string } | null
          }
          matched = body.device
        }
      }
    } finally {
      setBusy(false)
      busyRef.current = false
    }

    const ip = matched?.ip ?? parsed.ip ?? ""
    const port = String(matched?.port ?? parsed.port ?? 80)
    const name = parsed.model || matched?.name || parsed.serial || "Camera"
    const hik = parsed.verificationCode
      ? `Hik-Connect code for ${name}${parsed.serial ? `, serial ${parsed.serial}` : ""}. Connection is set to Hikvision ISAPI. Enter the recorder admin password. The verification code and the unlock pattern are not that password.`
      : ""
    const status = matched
      ? `${hik} Found it at ${ip}. Check the password, then save.`
      : ip
        ? `${hik} Address ${ip} was in the code. Check the password, then save.`
        : `${hik || `Serial ${parsed.serial} was read.`} It did not answer on this network, so enter its IP address.`

    setNote(status.trim())
    onApply({
      name,
      ipAddress: ip,
      onvifPort: port,
      protocol: parsed.verificationCode ? "ISAPI" : "ONVIF",
      username: parsed.verificationCode ? "admin" : "",
      password: "",
      note: status.trim(),
    })
  }

  async function startCamera() {
    setError(null)
    setNote(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setLive(true)
      timerRef.current = window.setInterval(() => {
        const video = videoRef.current
        if (!video || video.readyState < 2) return
        const payload = readQr(video, video.videoWidth, video.videoHeight)
        if (payload) void applyPayload(payload)
      }, 500)
    } catch {
      setError("The camera on this computer could not be opened.")
    }
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setNote(null)
    const bitmap = await createImageBitmap(file)
    const payload = readQr(bitmap, bitmap.width, bitmap.height)
    bitmap.close()
    if (!payload) {
      setError("No QR code was found in that image.")
      return
    }
    await applyPayload(payload)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-sl-surface shadow-sm">
      <div className="h-1.5 bg-sl-gradient" />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base">Scan QR code</h2>
            <p className="mt-1 max-w-2xl text-sm text-sl-text-muted">
              Hikvision's Hik-Connect screen puts the model, serial, and verification code in the QR.
              A recorder found on this network has its address filled in. The pattern on the recorder only unlocks that screen.
            </p>
          </div>
          <div className="flex gap-2">
            {live ? (
              <Button type="button" variant="outline" onClick={stopCamera}>
                Stop
              </Button>
            ) : (
              <Button type="button" onClick={() => void startCamera()} disabled={disabled || busy}>
                {busy ? "Looking up…" : "Scan with camera"}
              </Button>
            )}
            <label className="inline-flex h-8 cursor-pointer items-center rounded-lg border border-border bg-sl-surface px-3 text-sm font-medium">
              Upload photo
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={disabled || busy}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ""
                  void onFile(file)
                }}
              />
            </label>
          </div>
        </div>
        {live ? (
          <video ref={videoRef} muted playsInline className="max-h-64 w-full rounded-lg bg-black object-contain" />
        ) : (
          <video ref={videoRef} muted playsInline className="hidden" />
        )}
        {error ? (
          <p className="rounded-lg border border-sl-danger/30 bg-sl-danger/10 px-3 py-2 text-sm text-sl-danger" role="alert">
            {error}
          </p>
        ) : null}
        {note ? <p className="text-sm text-sl-text-muted">{note}</p> : null}
      </div>
    </section>
  )
}
