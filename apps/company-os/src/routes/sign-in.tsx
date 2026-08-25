import { modelMetadata } from "@company/model/metadata"
import { Button } from "@company/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { createFileRoute, redirect } from "@tanstack/react-router"
import { useState } from "react"

import { authClient } from "@/auth-client"
import { getCurrentSession } from "@/current-session"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Sign in",
  description: `Sign in to ${modelMetadata.name}.`,
  title: "Sign in",
}

export const Route = createFileRoute("/sign-in")({
  ...pageOptions(page),
  beforeLoad: async () => {
    const session = await getCurrentSession()
    if (session.status === "authenticated") throw redirect({ to: "/" })
    if (session.status === "forbidden") {
      throw redirect({ to: "/access-denied" })
    }
  },
  component: SignIn,
})

function SignIn() {
  const [error, setError] = useState<string>()
  const [pending, setPending] = useState(false)

  const beginSignIn = async () => {
    setError(undefined)
    setPending(true)
    const result = await authClient.signIn.social({
      callbackURL: "/",
      provider: "oidc",
    })
    if (result.error) {
      setError(result.error.message ?? "Sign in could not be started.")
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{modelMetadata.name}</CardTitle>
          <CardDescription>
            Use your organization&apos;s identity provider to continue.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="w-full" disabled={pending} onClick={beginSignIn}>
            {pending ? "Redirecting…" : "Continue to sign in"}
          </Button>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  )
}
