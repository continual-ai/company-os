import { Context, Effect, Layer } from "effect"

import { ServiceAccount } from "#/runtime/access/model/index.ts"
import type { ObjectCreateInput, ObjectRecord } from "#/runtime/model/index.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { makeObjectService } from "#/runtime/server/model/object-service.ts"

type ServiceAccountRecord = ObjectRecord<typeof ServiceAccount>
type ServiceAccountCreateInput = ObjectCreateInput<typeof ServiceAccount>

const make = Effect.gen(function* () {
  const records = yield* ObjectRepositories
  const repository = records.get(ServiceAccount)
  const base = yield* makeObjectService(ServiceAccount)
  const writer = records.writer(ServiceAccount)

  const provision = Effect.fn("@company/ServiceAccountService.provision")(
    function* (
      input: Pick<ServiceAccountRecord, "name"> &
        Partial<Pick<ServiceAccountRecord, "description" | "id">>
    ) {
      if (input.id !== undefined) {
        const actorId = yield* currentActorId
        return yield* repository.upsert({
          aliases: [],
          metadata: {},
          createdBy: actorId,
          updatedBy: actorId,
          systemManaged: false,
          description: input.description ?? null,
          name: input.name,
          id: input.id,
        })
      }
      const createInput: ServiceAccountCreateInput =
        input.description === undefined
          ? { name: input.name }
          : { description: input.description, name: input.name }
      return yield* writer.create(createInput)
    }
  )

  const reconcile = Effect.fn("@company/ServiceAccountService.reconcile")(
    function* (input: Pick<ServiceAccountRecord, "id" | "name">) {
      const current = yield* repository.get(input.id)
      if (current.name === input.name) return current
      return yield* writer.update({
        etag: current.etag,
        id: current.id,
        name: input.name,
      })
    }
  )

  return { ...base, provision, reconcile }
})

/** Governed ServiceAccount projections plus trusted JIT provisioning. */
export class ServiceAccountService extends Context.Service<ServiceAccountService>()(
  "@company/ServiceAccountService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
