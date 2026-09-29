"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Logo } from "@/components/brand/logo"
import { Wordmark } from "@/components/brand/wordmark"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { AuthFormState } from "@/server/auth-actions"

type AuthFormProps = {
  mode: "login" | "register"
  action: (
    state: AuthFormState,
    formData: FormData,
  ) => Promise<AuthFormState>
}

export function AuthForm({ mode, action }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {})
  const isLogin = mode === "login"

  return (
    <main className="flex min-h-svh items-center justify-center bg-sl-bg px-4 py-10">
      <section className="w-full max-w-md overflow-hidden rounded-2xl border border-border bg-sl-surface shadow-lg">
        <div className="h-1.5 bg-sl-gradient" />
        <div className="px-6 py-8 sm:px-8">
          <div className="mb-8 flex flex-col items-center gap-3 text-center">
            <Logo className="size-10" />
            <Wordmark />
            <div>
              <h1 className="text-xl">
                {isLogin ? "Sign in to CamCenter" : "Create your organization"}
              </h1>
              <p className="mt-1 text-sm text-sl-text-muted">
                {isLogin
                  ? "Use your operator account to open the control center."
                  : "The first account becomes the organization admin."}
              </p>
            </div>
          </div>

          <form action={formAction} className="space-y-4">
            {!isLogin && (
              <>
                <Field label="Name" name="name" autoComplete="name" />
                <Field
                  label="Organization"
                  name="organization"
                  autoComplete="organization"
                />
              </>
            )}
            <Field
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
            />
            <Field
              label="Password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
            />

            {state.error && (
              <p className="text-sm text-sl-danger" role="alert">
                {state.error}
              </p>
            )}

            <Button type="submit" className="h-10 w-full" disabled={pending}>
              {pending
                ? "Please wait"
                : isLogin
                  ? "Sign in"
                  : "Create account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-sl-text-muted">
            {isLogin ? "Need an organization?" : "Already have an account?"}{" "}
            <Link
              href={isLogin ? "/register" : "/login"}
              className="font-semibold text-sl-primary hover:underline"
            >
              {isLogin ? "Register" : "Sign in"}
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}

function Field({
  label,
  name,
  type = "text",
  autoComplete,
}: {
  label: string
  name: string
  type?: string
  autoComplete?: string
}) {
  const id = `auth-${name}`
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={name} type={type} autoComplete={autoComplete} required />
    </div>
  )
}
