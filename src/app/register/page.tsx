import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { auth } from "@/auth"
import { registerAction } from "@/server/auth-actions"

export default async function RegisterPage() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return <AuthForm mode="register" action={registerAction} />
}
