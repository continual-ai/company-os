import type { ObjectCreateInput, ObjectRecord } from "@company/runtime"
import { Context, Effect, Layer } from "effect"

import { Model } from "#/app.model.ts"
import { ObjectRepositories } from "#/server/model/object-repositories.ts"
import {
  makeObjectService,
  makeObjectWriter,
} from "#/server/model/object-service.ts"

type ServiceAccountRecord = ObjectRecord<
  (typeof Model.objects)["serviceAccount"]
>
type ServiceAccountCreateInput = ObjectCreateInput<
  (typeof Model.objects)["serviceAccount"]
>

const make = Effect.gen(function* () {
  const repository = (yield* ObjectRepositories).serviceAccount
  const base = yield* makeObjectService(
    Model.objects.serviceAccount,
    repository
  )
  const writer = yield* makeObjectWriter(
    Model.objects.serviceAccount,
    repository
  )

  const provision = Effect.fn("@company/ServiceAccountService.provision")(
    function* (
      input: Pick<ServiceAccountRecord, "name"> &
        Partial<Pick<ServiceAccountRecord, "description">>
    ) {
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
