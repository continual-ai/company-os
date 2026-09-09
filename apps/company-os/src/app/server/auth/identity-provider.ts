import { Config, Effect, Layer } from "effect"
import { z } from "zod"

import type { IdentityId } from "#/app.model.ts"
import {
  IdentityProvider,
  InvalidIdentityAssertion,
  type AuthenticatedSubject,
  type VerifiedIdentityInvocation,
} from "#/runtime/server/auth/identity-provider.ts"

const APP_RUNTIME_ASSERTION_HEADER = "x-continual-app-runtime-assertion"
const APP_RUNTIME_ORIGIN_HEADER = "x-continual-app-runtime-origin"

const ContinualActorSchema = z.object({
  actorId: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().min(1),
})

function runtimeCredential(
  headers: Headers,
  config: { readonly executionToken: string; readonly origin: string }
):
  | {
      readonly kind: "published"
      readonly origin: string
      readonly token: string
    }
  | {
      readonly kind: "preview"
      readonly origin: string
      readonly token: string
    }
  | null {
  const assertion = headers.get(APP_RUNTIME_ASSERTION_HEADER)?.trim()
  const forwardedOrigin = headers.get(APP_RUNTIME_ORIGIN_HEADER)?.trim()
  const configuredOrigin = config.origin.trim()
  if (assertion && !configuredOrigin) {
    throw new InvalidIdentityAssertion({
      reason: "CONTINUAL_URL must configure the trusted identity verifier.",
    })
  }
  if (
    assertion &&
    forwardedOrigin &&
    new URL(forwardedOrigin).origin !== new URL(configuredOrigin).origin
  ) {
    throw new InvalidIdentityAssertion({
      reason: "The forwarded identity origin is not trusted.",
    })
  }
  const publishedOrigin = configuredOrigin
  if (assertion && publishedOrigin) {
    return { kind: "published", origin: publishedOrigin, token: assertion }
  }

  const executionToken = config.executionToken.trim()
  return executionToken && configuredOrigin
    ? { kind: "preview", origin: configuredOrigin, token: executionToken }
    : null
}

function continualIdentityId(actorId: string): IdentityId {
  // Continual IDs satisfy the portable RecordId representation. This is the
  // single trust boundary where an externally verified ID enters the model.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return actorId as IdentityId
}

function localDevelopmentIdentity(): VerifiedIdentityInvocation | null {
  if (import.meta.env.MODE !== "development") return null
  // The development server is the trust boundary. Do not accept a
  // caller-supplied identity header that could be mistaken for provider proof.
  const subject = {
    email: "developer@company.test",
    issuer: "local-development",
    kind: "user" as const,
    name: "Local Developer",
    subject: "default",
  } satisfies AuthenticatedSubject
  return { actor: subject, authorizationSubject: subject }
}

export const makeContinualIdentityProvider = Effect.gen(function* () {
  const config = {
    executionToken: yield* Config.string("CONTINUAL_EXECUTION_TOKEN").pipe(
      Config.withDefault("")
    ),
    origin: yield* Config.string("CONTINUAL_URL").pipe(Config.withDefault("")),
  }

  const identify = Effect.fn("@company/IdentityProvider.identify")(function* (
    headers: Headers
  ) {
    const credential = yield* Effect.try({
      try: () => runtimeCredential(headers, config),
      catch: () =>
        new InvalidIdentityAssertion({
          reason: "Invalid or unconfigured identity verification origin.",
        }),
    })
    if (credential === null) return localDevelopmentIdentity()

    const actor = yield* Effect.tryPromise({
      try: async () => {
        const path =
          credential.kind === "published"
            ? "/api/apps/runtime/auth/me"
            : "/api/apps/runtime/auth/preview-me"
        const response = await fetch(new URL(path, credential.origin), {
          method: "GET",
          redirect: "error",
          signal: AbortSignal.timeout(10_000),
          headers: { authorization: `Bearer ${credential.token}` },
        })
        if (!response.ok)
          throw new Error(`Continual returned ${response.status}.`)
        return ContinualActorSchema.parse(await response.json())
      },
      catch: (cause) =>
        new InvalidIdentityAssertion({
          reason: cause instanceof Error ? cause.message : String(cause),
        }),
    })
    const subject = {
      email: actor.email ?? undefined,
      issuer: "continual",
      kind: "user" as const,
      name: actor.name,
      preferredIdentityId: continualIdentityId(actor.actorId),
      subject: actor.actorId,
    } satisfies AuthenticatedSubject
    return { actor: subject, authorizationSubject: subject }
  })

  return { identify }
})

/** Default host adapter, replaceable at application composition. */
export const continualIdentityProviderLayer = Layer.effect(
  IdentityProvider,
  makeContinualIdentityProvider
)
