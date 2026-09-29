import { redirect } from "next/navigation"
import { AuthForm } from "@/components/auth/auth-form"
import { auth } from "@/auth"
import { loginAction } from "@/server/auth-actions"

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect("/dashboard")

  return <AuthForm mode="login" action={loginAction} />
}
