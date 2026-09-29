export const roles = ["ADMIN", "OPERATOR", "VIEWER"] as const

export type Role = (typeof roles)[number]

export type SessionUser = {
  id: string
  name?: string | null
  email?: string | null
  role: Role
  organizationId: string
}
