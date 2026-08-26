import { Model } from "@company/model"
import {
  RecordId,
  Timestamp,
  type ActionInput,
  type RecordIdentifier,
} from "@company/runtime"
import { toEffectInputSchema } from "@company/runtime/effect"
import { generateRecordId } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer, Schema } from "effect"

import { generateSecret, hashSecret } from "@/server/auth/secret-token"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { currentActorId } from "@/server/invocation-context"
import { SYSTEM_SERVICE_ACCOUNT_ID } from "@/system-records"

import { ApiKeyRepository } from "./api-key-repository"
import { makeObjectService } from "./object-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"
import { ServiceAccountRepository } from "./service-account-repository"

const issueInputSchema = toEffectInputSchema(Model.actions.apiKey.issue.input)

class InvalidApiKeyRequest extends Data.TaggedError("InvalidApiKeyRequest")<{
  readonly reason: "disabledAccount" | "expiresAt" | "systemAccount"
}> {}

function now(): Timestamp {
  return Timestamp(new Date().toISOString())
}

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const identifiers = yield* RecordIdentifierResolver
  const repository = yield* ApiKeyRepository
  const serviceAccounts = yield* ServiceAccountRepository
  const base = yield* makeObjectService(Model.objects.apiKey, repository)

  const issue = Effect.fn("@company/ApiKeyService.issue")(function* (
    input: ActionInput<(typeof Model.actions.apiKey)["issue"]>
  ) {
    const decodedValue =
      yield* Schema.decodeUnknownEffect(issueInputSchema)(input)
    // SAFETY: issueInputSchema is compiled directly from this action's portable input.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const decoded = decodedValue as ActionInput<
      (typeof Model.actions.apiKey)["issue"]
    >
    const serviceAccountId = yield* identifiers.resolve(
      "serviceAccount",
      decoded.serviceAccount
    )
    if (serviceAccountId === SYSTEM_SERVICE_ACCOUNT_ID) {
      return yield* Effect.fail(
        new InvalidApiKeyRequest({ reason: "systemAccount" })
      )
    }
    if (
      decoded.expiresAt !== undefined &&
      Date.parse(decoded.expiresAt) <= Date.now()
    ) {
      return yield* Effect.fail(
        new InvalidApiKeyRequest({ reason: "expiresAt" })
      )
    }

    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireAction({
          actionId: "issue",
          objectType: "apiKey",
          parentId: serviceAccountId,
        })
        const serviceAccount = yield* serviceAccounts.get(serviceAccountId)
        if (serviceAccount.status !== "active") {
          return yield* Effect.fail(
            new InvalidApiKeyRequest({ reason: "disabledAccount" })
          )
        }

        const actorId = yield* currentActorId
        const id = RecordId("apiKey")(generateRecordId("apiKey"))
        const secret = generateSecret()
        const prefix = `cos_${id}`
        const apiKey = yield* repository.insert({
          aliases: [],
          createdBy: actorId,
          expiresAt: decoded.expiresAt ?? null,
          id,
          metadata: {},
          name: decoded.name,
          parent: serviceAccountId,
          prefix,
          revokedAt: null,
          systemManaged: false,
          updatedBy: actorId,
        })
        yield* repository.insertCredential(id, hashSecret(secret))
        return { apiKey: apiKey.id, secret: `${prefix}.${secret}` }
      })
    )
  })

  const revoke = Effect.fn("@company/ApiKeyService.revoke")(function* (
    identifier: RecordIdentifier<"apiKey">
  ) {
    const id = yield* identifiers.resolve("apiKey", identifier)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireAction({
          actionId: "revoke",
          objectType: "apiKey",
          recordIds: [id],
        })
        const apiKey = yield* repository.get(id)
        if (apiKey.revokedAt !== null) return apiKey
        const actorId = yield* currentActorId
        return yield* repository.update({
          etag: apiKey.etag,
          id,
          revokedAt: now(),
          updatedBy: actorId,
        })
      })
    )
  })

  return { ...base, issue, revoke }
})

export class ApiKeyService extends Context.Service<ApiKeyService>()(
  "@company/ApiKeyService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
