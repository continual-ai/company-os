import { RecordId } from "@company/runtime"
import { Context, Data, Effect, Layer } from "effect"

import { ApiKeyRepository } from "@/server/objects/api-key-repository.server"

import { secretMatches } from "./secret-token.server"

class InvalidApiKey extends Data.TaggedError("InvalidApiKey")<{}> {}

const make = Effect.gen(function* () {
  const repository = yield* ApiKeyRepository

  const authenticate = Effect.fn("@company/ApiKeyAuthentication.authenticate")(
    function* (authorizationHeader: string) {
      if (authorizationHeader.length > 256) {
        return yield* Effect.fail(new InvalidApiKey())
      }
      const match = /^Bearer (cos_([^.]+)\.(.+))$/.exec(authorizationHeader)
      if (match === null) return yield* Effect.fail(new InvalidApiKey())

      const apiKeyId = RecordId("apiKey")(match[2]!)
      const [apiKey, credential] = yield* Effect.all([
        repository.get(apiKeyId),
        repository.findCredential(apiKeyId),
      ]).pipe(Effect.catch(() => Effect.fail(new InvalidApiKey())))

      if (
        credential === undefined ||
        apiKey.revokedAt !== null ||
        (apiKey.expiresAt !== null &&
          Date.parse(apiKey.expiresAt) <= Date.now()) ||
        !secretMatches(match[3]!, credential.secretHash)
      ) {
        return yield* Effect.fail(new InvalidApiKey())
      }

      yield* repository.markUsed(apiKeyId, new Date())
      return { apiKeyId, serviceAccountId: apiKey.parent }
    }
  )

  return { authenticate }
})

/** Authenticates an API key as its canonical ServiceAccount identity. */
export class ApiKeyAuthentication extends Context.Service<ApiKeyAuthentication>()(
  "@company/ApiKeyAuthentication",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
