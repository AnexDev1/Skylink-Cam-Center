"use server"

import { AuthError } from "next-auth"
import { signIn, signOut } from "@/auth"
import { hashPassword } from "@/lib/password"
import { prisma } from "@/server/db"

export type AuthFormState = {
  error?: string
}

function readField(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === "string" ? value.trim() : ""
}

export async function loginAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  try {
    await signIn("credentials", {
      email: readField(formData, "email").toLowerCase(),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." }
    }
    throw error
  }

  return {}
}

export async function registerAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const name = readField(formData, "name")
  const email = readField(formData, "email").toLowerCase()
  const password = formData.get("password")
  const organizationName = readField(formData, "organization")

  if (!name || !email || !organizationName || typeof password !== "string") {
    return { error: "Fill in every field." }
  }
  if (!email.includes("@")) {
    return { error: "Enter a valid email address." }
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." }
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return { error: "An account with that email already exists." }
  }

  const passwordHash = await hashPassword(password)
  await prisma.organization.create({
    data: {
      name: organizationName,
      users: {
        create: {
          name,
          email,
          passwordHash,
          role: "ADMIN",
        },
      },
    },
  })

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Account created, but sign-in failed. Try logging in." }
    }
    throw error
  }

  return {}
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" })
}
