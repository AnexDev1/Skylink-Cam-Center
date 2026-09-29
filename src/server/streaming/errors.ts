export type StreamErrorCode =
  | "STREAM_GATEWAY_UNAVAILABLE"
  | "STREAM_NO_SOURCE"
  | "STREAM_REJECTED"

export class StreamError extends Error {
  readonly code: StreamErrorCode

  constructor(code: StreamErrorCode, message: string) {
    super(message)
    this.name = "StreamError"
    this.code = code
  }
}
