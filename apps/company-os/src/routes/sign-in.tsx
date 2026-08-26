import { Badge } from "@company/ui/components/badge"
import { Button, buttonVariants } from "@company/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import { cn } from "@company/ui/lib/utils"
import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"
import { ArrowRightIcon, CheckIcon } from "lucide-react"

import { safeReturnTo } from "@/auth-navigation"
import { getAuthenticationExperience } from "@/authentication-experience.functions"
import { BrandMark } from "@/customization/brand"
import { applicationConfig } from "@/customization/config"
import { EntryPanel } from "@/customization/entry"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Sign in",
  description: `Sign in to ${applicationConfig.identity.productName}.`,
  title: "Sign in",
}

const AuthenticationSearch = Schema.Struct({
  returnTo: Schema.optional(Schema.String),
})

export const Route = createFileRoute("/sign-in")({
  ...pageOptions(page),
  validateSearch: (search) => {
    const parsed = Schema.decodeUnknownSync(AuthenticationSearch)(search)
    return { returnTo: safeReturnTo(parsed.returnTo) }
  },
  loaderDeps: ({ search }) => ({ returnTo: search.returnTo }),
  loader: async ({ deps }) => ({
    experience: await getAuthenticationExperience({ data: deps.returnTo }),
    page,
  }),
  component: SignIn,
})

function SignIn() {
  const { experience } = Route.useLoaderData()
  const { returnTo } = Route.useSearch()

  return (
    <main className="grid min-h-svh bg-background lg:grid-cols-2">
      <section className="relative flex min-h-svh items-center justify-center p-6 sm:p-10">
        <div className="absolute top-6 left-6 flex items-center gap-3 sm:top-8 sm:left-8">
          <BrandMark />
          <div>
            <p className="text-sm font-semibold">
              {applicationConfig.identity.productName}
            </p>
            <p className="text-xs text-muted-foreground">
              {applicationConfig.identity.descriptor}
            </p>
          </div>
        </div>

        <div className="w-full max-w-md pt-20 sm:pt-16">
          {experience.kind === "external" ? (
            <Card>
              <CardHeader>
                <CardTitle>Continue to sign in</CardTitle>
                <CardDescription>
                  Your deployment gateway verifies your identity before
                  returning you to {applicationConfig.identity.productName}.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full"
                  nativeButton={false}
                  render={
                    <a
                      href={experience.signInPath}
                      aria-label="Continue to sign in"
                    />
                  }
                >
                  Continue
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">
                    Choose a local identity
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Test the application as people with different business
                    permissions.
                  </p>
                </div>
                <Badge variant="outline">Development only</Badge>
              </div>

              <form
                action="/auth/local-session"
                method="post"
                className="mt-7 grid gap-3"
              >
                <input type="hidden" name="returnTo" value={returnTo} />
                {experience.profiles.map((profile) => {
                  const selected = profile.id === experience.selectedProfileId
                  return (
                    <button
                      key={profile.id}
                      type="submit"
                      name="profileId"
                      value={profile.id}
                      className={cn(
                        buttonVariants({ variant: "outline" }),
                        "h-auto w-full justify-start gap-4 p-4 text-left whitespace-normal",
                        selected && "border-primary ring-1 ring-primary/20"
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center bg-muted text-xs font-semibold text-foreground">
                        {profile.name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">
                            {profile.name}
                          </span>
                          <Badge variant="secondary">{profile.role}</Badge>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {profile.email}
                        </span>
                        <span className="mt-2 block text-xs/relaxed text-muted-foreground">
                          {profile.description}
                        </span>
                      </span>
                      {selected ? (
                        <span className="text-primary">
                          <CheckIcon className="size-4" />
                          <span className="sr-only">Current identity</span>
                        </span>
                      ) : (
                        <ArrowRightIcon className="size-4 text-muted-foreground" />
                      )}
                    </button>
                  )
                })}
              </form>
            </div>
          )}
        </div>
      </section>

      <EntryPanel />
    </main>
  )
}
