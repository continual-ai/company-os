import { createAppServerClient } from "@continual/sdk/app"
import { Effect, Layer } from "effect"

import type { IdentityId } from "#/app.model.ts"
import {
  IdentityProvider,
  InvalidIdentityAssertion,
  type AuthenticatedSubject,
} from "#/runtime/server/auth/identity-provider.ts"

export const makeContinualIdentityProvider = Effect.sync(() => ({
  identify: (headers: Headers) =>
    Effect.tryPromise({
      try: async (): Promise<AuthenticatedSubject> => {
        // The kernel accepts headers; the SDK owns verification for both preview
        // and published requests. The synthetic URL is never used for authority.
        const actor = await createAppServerClient({
          request: new Request("http://company-os.internal", { headers }),
        }).auth.me()
        return {
          issuer: "continual",
          subject: actor.actorId,
          // The public SDK supplies actorId, name and email, not project claims.
          kind: actor.actorId.startsWith("sa_") ? "serviceAccount" : "user",
          email: actor.email ?? undefined,
          name: actor.name,
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          preferredIdentityId: actor.actorId as IdentityId,
        }
      },
      catch: () =>
        new InvalidIdentityAssertion({
          reason: "Continual project access is required.",
        }),
    }),
}))

export const continualIdentityProviderLayer = Layer.effect(
  IdentityProvider,
  makeContinualIdentityProvider
)
