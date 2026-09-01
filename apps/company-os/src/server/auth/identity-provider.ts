import type { IdentityId } from "@company/model"
import { Config, Context, Data, Effect, Layer } from "effect"
import { z } from "zod"

const APP_RUNTIME_ASSERTION_HEADER = "x-continual-app-runtime-assertion"
const APP_RUNTIME_ORIGIN_HEADER = "x-continual-app-runtime-origin"

const ContinualActorSchema = z.object({
  actorId: z.string().min(1),
  email: z.string().email().nullable(),
  name: z.string().min(1),
})

type IdentityKind = "serviceAccount" | "user"

/** Provider-neutral identity after credentials have been verified. */
export interface AuthenticatedSubject {
  readonly email: string | undefined
  readonly issuer: string
  readonly kind: IdentityKind
  readonly name: string | undefined
  /** Optional canonical App ID. Continual supplies its existing `us_…` ID. */
  readonly preferredIdentityId?: IdentityId | undefined
  readonly subject: string
}

export interface VerifiedIdentityInvocation {
  readonly actor: AuthenticatedSubject
  readonly authorizationSubject: AuthenticatedSubject
}

class InvalidIdentityAssertion extends Data.TaggedError(
  "InvalidIdentityAssertion"
)<{ readonly reason: string }> {}

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
  const publishedOrigin = forwardedOrigin || configuredOrigin
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

const make = Effect.gen(function* () {
  const config = {
    executionToken: yield* Config.string("CONTINUAL_EXECUTION_TOKEN").pipe(
      Config.withDefault("")
    ),
    origin: yield* Config.string("CONTINUAL_URL").pipe(Config.withDefault("")),
  }

  const identify = Effect.fn("@company/IdentityProvider.identify")(function* (
    headers: Headers
  ) {
    const credential = runtimeCredential(headers, config)
    if (credential === null) return null

    const actor = yield* Effect.tryPromise({
      try: async () => {
        const path =
          credential.kind === "published"
            ? "/api/apps/runtime/auth/me"
            : "/api/apps/runtime/auth/preview-me"
        const response = await fetch(new URL(path, credential.origin), {
          method: "GET",
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

/** Replaceable credential-verification boundary; Continual is the default. */
export class IdentityProvider extends Context.Service<IdentityProvider>()(
  "@company/IdentityProvider",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
