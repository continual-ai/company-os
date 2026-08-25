import { Model } from "@company/model"
import {
  isRecordAlias,
  RecordId,
  Timestamp,
  type ActionInput,
  type RecordIdentifier,
} from "@company/runtime"
import { toEffectInputSchema } from "@company/runtime/effect"
import { generateRecordId } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer, Schema } from "effect"

import { generateSecret, hashSecret } from "@/server/auth/secret-token.server"
import { Authorization } from "@/server/authorization/authorization-service.server"
import { SYSTEM_SERVICE_ACCOUNT_ID } from "@/server/authorization/well-known-authorization.server"
import { Database } from "@/server/database/database.server"
import { makeRecordAliasResolver } from "@/server/database/model-storage.server"
import { currentActorId } from "@/server/invocation-context.server"

import { ApiKeyRepository } from "./api-key-repository.server"
import { makeObjectService } from "./object-service.server"

const issueInputSchema = toEffectInputSchema(Model.actions.apiKey.issue.input)

class InvalidApiKeyRequest extends Data.TaggedError("InvalidApiKeyRequest")<{
  readonly reason: "expiresAt" | "systemAccount"
}> {}

function now(): Timestamp {
  return Timestamp(new Date().toISOString())
}

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const repository = yield* ApiKeyRepository
  const resolveAliases = yield* makeRecordAliasResolver
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
    const serviceAccountId = isRecordAlias(decoded.serviceAccount)
      ? RecordId("serviceAccount")(
          (yield* resolveAliases("serviceAccount", [
            decoded.serviceAccount,
          ]))[0]!
        )
      : RecordId("serviceAccount")(decoded.serviceAccount)
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
          parentTypeId: "serviceAccount",
        })

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
    const id = isRecordAlias(identifier)
      ? RecordId("apiKey")((yield* resolveAliases("apiKey", [identifier]))[0]!)
      : RecordId("apiKey")(identifier)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireAction({
          actionId: "revoke",
          modifiesTarget: true,
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
