import { Badge } from "@company/ui/components/badge"
import { Button } from "@company/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@company/ui/components/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@company/ui/components/select"
import { createFileRoute } from "@tanstack/react-router"
import { Schema } from "effect"
import { ArrowRightIcon } from "lucide-react"
import { useState } from "react"

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
  const [localProfileId, setLocalProfileId] = useState(
    experience.kind === "local"
      ? (experience.selectedProfileId ?? experience.profiles[0]?.id ?? null)
      : null
  )
  const localProfile =
    experience.kind === "local"
      ? experience.profiles.find(({ id }) => id === localProfileId)
      : undefined

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
                className="mt-7 grid gap-4"
              >
                <input type="hidden" name="returnTo" value={returnTo} />

                <div className="grid gap-2">
                  <label
                    htmlFor="local-profile"
                    className="text-sm font-medium"
                  >
                    Identity
                  </label>
                  <Select
                    name="profileId"
                    value={localProfileId}
                    onValueChange={setLocalProfileId}
                  >
                    <SelectTrigger
                      id="local-profile"
                      className="h-11 w-full px-3 text-sm"
                    >
                      <SelectValue placeholder="Choose an identity">
                        {localProfile ? (
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-medium">
                              {localProfile.name}
                            </span>
                            <Badge variant="secondary">
                              {localProfile.role}
                            </Badge>
                          </span>
                        ) : null}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent align="start" alignItemWithTrigger={false}>
                      {experience.profiles.map((profile) => (
                        <SelectItem
                          key={profile.id}
                          value={profile.id}
                          className="items-start py-3"
                        >
                          <span className="min-w-0 pr-2">
                            <span className="flex items-center gap-2">
                              <span className="font-medium">
                                {profile.name}
                              </span>
                              <Badge variant="secondary">{profile.role}</Badge>
                            </span>
                            <span className="mt-1 block max-w-sm whitespace-normal text-muted-foreground">
                              {profile.description}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={!localProfile}
                >
                  {localProfile
                    ? `Continue as ${localProfile.name}`
                    : "Continue"}
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </form>
            </div>
          )}
        </div>
      </section>

      <EntryPanel />
    </main>
  )
}
