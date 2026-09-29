import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "@/auth.config"
import { verifyPassword } from "@/lib/password"
import { prisma } from "@/server/db"
import type { Role } from "@/types/auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials.email
        const password = credentials.password
        if (typeof email !== "string" || typeof password !== "string") {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        })
        if (!user) return null

        const valid = await verifyPassword(user.passwordHash, password)
        if (!valid) return null

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organizationId: user.organizationId,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.role = user.role
        token.organizationId = user.organizationId
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? ""
        session.user.role = (token.role ?? "VIEWER") as Role
        session.user.organizationId =
          typeof token.organizationId === "string" ? token.organizationId : ""
      }
      return session
    },
  },
})
