import { Config, Effect, Layer } from "effect"

import { continualIdentityProviderLayer } from "#/app/server/auth/identity-provider.ts"
import { jwtIdentityProviderLayer } from "#/app/server/auth/jwt-identity-provider.ts"

/** Credentials vary by deployment; project admission and business rules stay the same. */
export const identityProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const provider = yield* Config.string("IDENTITY_PROVIDER").pipe(
      Config.withDefault("continual")
    )
    if (provider === "continual") return continualIdentityProviderLayer
    if (provider === "jwt") return jwtIdentityProviderLayer
    return yield* Effect.fail(
      new Error("IDENTITY_PROVIDER must be continual or jwt.")
    )
  })
)
