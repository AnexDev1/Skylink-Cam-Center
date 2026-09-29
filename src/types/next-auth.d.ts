import type { DefaultSession } from "next-auth"
import type { Role } from "@/types/auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: Role
      organizationId: string
    } & DefaultSession["user"]
  }

  interface User {
    role: Role
    organizationId: string
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role
    organizationId?: string
  }
}
