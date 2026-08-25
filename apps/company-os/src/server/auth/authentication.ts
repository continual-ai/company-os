import { Context, Data, Effect, Layer } from "effect"

import { authenticatedInvocation } from "@/server/invocation-context"

import { ApiKeyAuthentication } from "./api-key-authentication"
import { UserAuthentication } from "./user-authentication"

class UnsupportedAuthorization extends Data.TaggedError(
  "UnsupportedAuthorization"
)<{}> {}

const make = Effect.gen(function* () {
  const users = yield* UserAuthentication
  const apiKeys = yield* ApiKeyAuthentication

  const authenticate = Effect.fn("@company/Authentication.authenticate")(
    function* (headers: Headers) {
      const authorizationHeader = headers.get("authorization")
      if (authorizationHeader !== null) {
        if (!authorizationHeader.startsWith("Bearer cos_")) {
          return yield* Effect.fail(new UnsupportedAuthorization())
        }
        const key = yield* apiKeys.authenticate(authorizationHeader)
        return yield* authenticatedInvocation(key.serviceAccountId)
      }

      const user = yield* users.authenticate(headers)
      return yield* authenticatedInvocation(user.id)
    }
  )

  return { authenticate }
})

/** Authenticates a User session or ServiceAccount API key into one invocation. */
export class Authentication extends Context.Service<Authentication>()(
  "@company/Authentication",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
