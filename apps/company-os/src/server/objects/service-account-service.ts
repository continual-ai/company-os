import { Model } from "@company/model"
import { RecordId, type ObjectRecord } from "@company/runtime"
import { generateRecordId } from "@company/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { currentActorId } from "@/server/invocation-context"
import { PLATFORM_ID } from "@/system-records"

import { makeObjectService } from "./object-service"
import { ServiceAccountRepository } from "./service-account-repository"

type ServiceAccountRecord = ObjectRecord<
  (typeof Model.objects)["serviceAccount"]
>

const make = Effect.gen(function* () {
  const repository = yield* ServiceAccountRepository
  const base = yield* makeObjectService(
    Model.objects.serviceAccount,
    repository
  )

  const provision = Effect.fn("@company/ServiceAccountService.provision")(
    function* (
      input: Pick<ServiceAccountRecord, "name"> &
        Partial<Pick<ServiceAccountRecord, "description">>
    ) {
      const actorId = yield* currentActorId
      return yield* repository.insert({
        aliases: [],
        createdBy: actorId,
        description: input.description ?? null,
        id: RecordId("serviceAccount")(generateRecordId("serviceAccount")),
        metadata: {},
        name: input.name,
        parent: PLATFORM_ID,
        status: "active",
        systemManaged: false,
        updatedBy: actorId,
      })
    }
  )

  return { ...base, provision }
})

/** Governed ServiceAccount projections plus trusted JIT provisioning. */
export class ServiceAccountService extends Context.Service<ServiceAccountService>()(
  "@company/ServiceAccountService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
