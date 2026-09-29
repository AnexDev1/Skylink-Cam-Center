import NextAuth from "next-auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { authConfig } from "@/auth.config"

const { auth } = NextAuth(authConfig)

const handleAuth = auth((request) => {
  const isDashboard = request.nextUrl.pathname.startsWith("/dashboard")
  if (isDashboard && !request.auth) {
    const loginUrl = new URL("/login", request.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export function proxy(request: NextRequest) {
  const run = handleAuth as unknown as (request: NextRequest) => Response
  return run(request)
}
