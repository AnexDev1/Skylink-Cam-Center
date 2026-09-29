import type { NextAuthConfig } from "next-auth"

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isDashboard = request.nextUrl.pathname.startsWith("/dashboard")
      if (!isDashboard) return true
      return !!auth?.user
    },
  },
  trustHost: true,
} satisfies NextAuthConfig
