import { Model } from "@company/model"
import {
  isRecordAlias,
  RecordId,
  type ObjectRecord,
  type RecordIdentifier,
} from "@company/runtime"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { makeRecordAliasResolver } from "@/server/database/model-storage"
import { currentActorId } from "@/server/invocation-context"

import { makeObjectService } from "./object-service"
import { ServiceAccountRepository } from "./service-account-repository"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const repository = yield* ServiceAccountRepository
  const resolveAliases = yield* makeRecordAliasResolver
  const base = yield* makeObjectService(
    Model.objects.serviceAccount,
    repository
  )

  const setStatus = Effect.fn("@company/ServiceAccountService.setStatus")(
    function* (
      identifier: RecordIdentifier<"serviceAccount">,
      status: ObjectRecord<(typeof Model.objects)["serviceAccount"]>["status"]
    ) {
      const id = isRecordAlias(identifier)
        ? RecordId("serviceAccount")(
            (yield* resolveAliases("serviceAccount", [identifier]))[0]!
          )
        : RecordId("serviceAccount")(identifier)
      return yield* database.transaction(() =>
        Effect.gen(function* () {
          yield* authorization.requireAction({
            actionId: status === "active" ? "enable" : "disable",
            modifiesTarget: true,
            objectType: "serviceAccount",
            recordIds: [id],
          })
          const serviceAccount = yield* repository.get(id)
          if (serviceAccount.status === status) return serviceAccount
          return yield* repository.update({
            etag: serviceAccount.etag,
            id,
            status,
            updatedBy: yield* currentActorId,
          })
        })
      )
    }
  )

  const disable = Effect.fn("@company/ServiceAccountService.disable")(
    function* (identifier: RecordIdentifier<"serviceAccount">) {
      return yield* setStatus(identifier, "disabled")
    }
  )

  const enable = Effect.fn("@company/ServiceAccountService.enable")(function* (
    identifier: RecordIdentifier<"serviceAccount">
  ) {
    return yield* setStatus(identifier, "active")
  })

  return { ...base, disable, enable }
})

export class ServiceAccountService extends Context.Service<ServiceAccountService>()(
  "@company/ServiceAccountService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
