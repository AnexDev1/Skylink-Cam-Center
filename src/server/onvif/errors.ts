export const onvifErrorCodes = [
  "ONVIF_UNREACHABLE",
  "ONVIF_AUTH_FAILED",
  "ONVIF_UNSUPPORTED_OPERATION",
  "ONVIF_REQUEST_FAILED",
] as const

export type OnvifErrorCode = (typeof onvifErrorCodes)[number]

export class OnvifError extends Error {
  readonly code: OnvifErrorCode

  constructor(code: OnvifErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = "OnvifError"
    this.code = code
  }
}

export function mapOnvifError(error: unknown) {
  if (error instanceof OnvifError) return error

  const message = error instanceof Error ? error.message : String(error)
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : ""
  const haystack = `${code} ${message}`.toLowerCase()

  if (
    code === "ECONNREFUSED" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "ETIMEDOUT" ||
    code === "ECONNRESET" ||
    code === "EAI_AGAIN" ||
    haystack.includes("timeout") ||
    haystack.includes("timed out") ||
    haystack.includes("econnrefused") ||
    haystack.includes("network is unreachable") ||
    haystack.includes("socket")
  ) {
    return new OnvifError(
      "ONVIF_UNREACHABLE",
      "The camera did not respond. Check the IP address, port, and network path.",
      { cause: error },
    )
  }

  if (
    haystack.includes("notauthorized") ||
    haystack.includes("not authorized") ||
    haystack.includes("unauthorized") ||
    haystack.includes("failed authentication") ||
    haystack.includes("401")
  ) {
    return new OnvifError(
      "ONVIF_AUTH_FAILED",
      "The camera rejected the username or password.",
      { cause: error },
    )
  }

  if (
    haystack.includes("actionnotsupported") ||
    haystack.includes("not supported") ||
    haystack.includes("not implemented") ||
    haystack.includes("no such service") ||
    haystack.includes("optional action not implemented")
  ) {
    return new OnvifError(
      "ONVIF_UNSUPPORTED_OPERATION",
      "This camera does not implement that ONVIF operation.",
      { cause: error },
    )
  }

  return new OnvifError(
    "ONVIF_REQUEST_FAILED",
    message || "The ONVIF request failed.",
    { cause: error },
  )
}
