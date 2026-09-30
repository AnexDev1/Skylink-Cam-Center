export const deviceErrorCodes = ["UNREACHABLE", "AUTH_FAILED", "ISAPI_DISABLED", "RTSP_UNREACHABLE"] as const

export type DeviceErrorCode = (typeof deviceErrorCodes)[number]

export class DeviceError extends Error {
  readonly code: DeviceErrorCode

  constructor(code: DeviceErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "DeviceError"
    this.code = code
  }
}
