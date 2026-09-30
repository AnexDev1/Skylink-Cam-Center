import { NextResponse } from "next/server"
import { authorize, findScopedCamera, notFound } from "@/server/access"
import { StreamError, unregisterStream } from "@/server/streaming"

export const runtime = "nodejs"

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { actor, response } = await authorize("view")
  if (!actor) return response

  const { id } = await context.params
  const camera = await findScopedCamera(actor, id)
  if (!camera) return notFound("Camera")

  try {
    await unregisterStream(camera.id)
    return NextResponse.json({ stopped: true })
  } catch (error) {
    const message =
      error instanceof StreamError
        ? error.message
        : "The stream could not be stopped."
    const code = error instanceof StreamError ? error.code : "STREAM_REJECTED"
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
