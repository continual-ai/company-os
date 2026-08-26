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
import { CompanyIdentity, CompanySignInMedia } from "@/company/brand"
import { companyConfig } from "@/company/config"
import { getCurrentSession } from "@/current-session.functions"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Sign in",
  description: `Sign in to ${companyConfig.identity.productName}.`,
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
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <section className="flex min-h-svh items-center justify-center p-6 py-10 lg:p-12">
        <div className="w-full max-w-sm">
          <CompanyIdentity className="mb-8 lg:hidden" />
          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>
                Use your organization&apos;s identity provider to continue to{" "}
                {companyConfig.identity.productName}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                className="w-full"
                disabled={pending}
                onClick={beginSignIn}
              >
                {pending ? "Redirecting…" : "Continue to sign in"}
              </Button>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </section>

      <aside className="company-sign-in-field text-company-brand-field-foreground relative hidden min-h-svh overflow-hidden lg:flex">
        <CompanySignInMedia className="absolute inset-0 opacity-55" />
        <div
          aria-hidden="true"
          className="company-sign-in-grid absolute inset-0"
        />
        <div className="relative z-10 flex w-full flex-col justify-between p-10 xl:p-14">
          <CompanyIdentity
            className="text-company-brand-field-foreground"
            markClassName="bg-company-brand-field-foreground text-company-brand-field"
          />

          <div className="max-w-xl pb-4">
            <p className="text-company-brand-field-muted text-sm font-medium">
              {companyConfig.identity.descriptor}
            </p>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance xl:text-5xl">
              {companyConfig.signIn.headline}
            </h1>
            <p className="text-company-brand-field-muted mt-5 max-w-lg text-base leading-7">
              {companyConfig.signIn.description}
            </p>
            <ul className="mt-8 space-y-4">
              {companyConfig.signIn.highlights.map((highlight) => (
                <li
                  key={highlight}
                  className="text-company-brand-field-foreground flex gap-3 text-sm leading-6"
                >
                  <span
                    aria-hidden="true"
                    className="bg-company-brand-field-muted mt-2 size-1.5 shrink-0"
                  />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </main>
  )
}
