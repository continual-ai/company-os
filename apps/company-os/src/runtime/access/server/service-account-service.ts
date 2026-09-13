import { Context, Effect, Layer } from "effect"

import { ServiceAccount } from "#/runtime/access/model/index.ts"
import type { ObjectCreateInput, ObjectRecord } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"

type ServiceAccountRecord = ObjectRecord<typeof ServiceAccount>
type ServiceAccountCreateInput = ObjectCreateInput<typeof ServiceAccount>

const make = Effect.gen(function* () {
  const records = yield* RecordStore
  const repository = records.get(ServiceAccount)
  const writer = (yield* Database).repository(ServiceAccount)

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

  return { provision, reconcile }
})

/** Governed ServiceAccount projections plus trusted JIT provisioning. */
export class ServiceAccountService extends Context.Service<ServiceAccountService>()(
  "@company/ServiceAccountService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
