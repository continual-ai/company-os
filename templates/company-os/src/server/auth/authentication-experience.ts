import { Effect } from "effect"

import { safeReturnTo } from "@/auth-navigation"
import type { AuthenticationExperience } from "@/authentication-experience"
import { applicationRuntime } from "@/server/application-runtime"

import { AuthSettings, type ProvisioningRole } from "./auth-config"
import { localIdentityProfileId } from "./local-identity-session"

const profilePresentation = {
  administrator: {
    description:
      "Full access to operations, development tools, and access settings.",
    role: "Administrator",
  },
  none: {
    description:
      "No default permissions, for verifying denied and hidden experiences.",
    role: "Restricted",
  },
  operator: {
    description:
      "Manage operating records without administering identities or access.",
    role: "Operator",
  },
} as const satisfies Record<
  ProvisioningRole,
  { description: string; role: string }
>

export function readAuthenticationExperience(
  headers: Headers,
  returnTo: string
): Promise<AuthenticationExperience> {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const config = yield* AuthSettings
      if (config.provider.kind === "jwt") {
        return {
          kind: "external" as const,
          signInPath: safeReturnTo(returnTo),
        }
      }
      const selectedProfileId = localIdentityProfileId(
        headers,
        config.provider.cookieName
      )
      return {
        kind: "local" as const,
        profiles: config.provider.profiles.map((profile) => ({
          ...profilePresentation[profile.provisioningRole],
          email: profile.email,
          id: profile.id,
          name: profile.name,
        })),
        selectedProfileId: config.provider.profiles.some(
          ({ id }) => id === selectedProfileId
        )
          ? selectedProfileId
          : undefined,
      }
    })
  )
}

export function readSignOutPath(): Promise<{
  readonly cookieName?: string
  readonly path: string
}> {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const config = yield* AuthSettings
      return config.provider.kind === "local"
        ? { cookieName: config.provider.cookieName, path: "/sign-in" }
        : { path: config.provider.signOutPath }
    })
  )
}

export function selectLocalAuthenticationProfile(
  profileId: string
): Promise<{ readonly cookieName: string; readonly profileId: string } | null> {
  return applicationRuntime.runPromise(
    Effect.gen(function* () {
      const config = yield* AuthSettings
      if (config.provider.kind !== "local") return null
      const profile = config.provider.profiles.find(
        ({ id }) => id === profileId
      )
      return profile === undefined
        ? null
        : { cookieName: config.provider.cookieName, profileId: profile.id }
    })
  )
}
