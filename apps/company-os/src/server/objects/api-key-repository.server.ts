import { Model } from "@company/model"
import { and, eq, isNull, lt, or } from "drizzle-orm"
import { Context, Effect, Layer } from "effect"

import { Database } from "@/server/database/database.server"
import { makeObjectRepository } from "@/server/database/model-storage.server"
import { apiKeyCredentials } from "@/server/database/schema.server"

const make = Effect.gen(function* () {
  const database = yield* Database
  const base = yield* makeObjectRepository(Model.objects.apiKey)

  const insertCredential = Effect.fn(
    "@company/ApiKeyRepository.insertCredential"
  )(function* (apiKeyId: string, secretHash: string) {
    yield* database.insert(apiKeyCredentials).values({ apiKeyId, secretHash })
  })

  const findCredential = Effect.fn("@company/ApiKeyRepository.findCredential")(
    function* (apiKeyId: string) {
      const rows = yield* database
        .select({
          lastUsedAt: apiKeyCredentials.lastUsedAt,
          secretHash: apiKeyCredentials.secretHash,
        })
        .from(apiKeyCredentials)
        .where(eq(apiKeyCredentials.apiKeyId, apiKeyId))
        .limit(1)
      return rows[0]
    }
  )

  const markUsed = Effect.fn("@company/ApiKeyRepository.markUsed")(function* (
    apiKeyId: string,
    usedAt: Date
  ) {
    const refreshBefore = new Date(usedAt.getTime() - 15 * 60 * 1000)
    yield* database
      .update(apiKeyCredentials)
      .set({ lastUsedAt: usedAt })
      .where(
        and(
          eq(apiKeyCredentials.apiKeyId, apiKeyId),
          or(
            isNull(apiKeyCredentials.lastUsedAt),
            lt(apiKeyCredentials.lastUsedAt, refreshBefore)
          )
        )
      )
  })

  return { ...base, findCredential, insertCredential, markUsed }
})

export class ApiKeyRepository extends Context.Service<ApiKeyRepository>()(
  "@company/ApiKeyRepository",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
