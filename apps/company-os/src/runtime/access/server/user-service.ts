import { Context, Effect, Layer } from "effect"

import { User } from "#/runtime/access/model/index.ts"
import {
  RecordId,
  type ObjectCreateInput,
  type ObjectRecord,
} from "#/runtime/model/index.ts"
import { ROOT_ID } from "#/runtime/model/system-records.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { makeObjectService } from "#/runtime/server/model/object-service.ts"
import type { ObjectInsert } from "#/runtime/server/storage/object-repository.ts"

type UserRecord = ObjectRecord<typeof User>
type UserCreateInput = ObjectCreateInput<typeof User>

const make = Effect.gen(function* () {
  const records = yield* ObjectRepositories
  const repository = records.get(User)
  const base = yield* makeObjectService(User)
  const writer = records.writer(User)

  const provision = Effect.fn("@company/UserService.provision")(function* (
    input: Pick<UserRecord, "email" | "name"> &
      Partial<Pick<UserRecord, "image">> & { readonly id?: string }
  ) {
    if (input.id !== undefined) {
      const actorId = yield* currentActorId
      return yield* repository.insert({
        aliases: [],
        createdBy: actorId,
        email: input.email,
        id: RecordId("user")(input.id),
        image: input.image ?? null,
        metadata: {},
        name: input.name,
        parent: ROOT_ID,
        status: "active",
        systemManaged: false,
        updatedBy: actorId,
      } satisfies ObjectInsert<typeof User>)
    }
    const createInput: UserCreateInput =
      input.image === undefined
        ? { email: input.email, name: input.name }
        : { email: input.email, image: input.image, name: input.name }
    return yield* writer.create(createInput)
  })

  const reconcile = Effect.fn("@company/UserService.reconcile")(function* (
    input: Pick<UserRecord, "email" | "id" | "name">
  ) {
    const current = yield* repository.get(input.id)
    if (current.email === input.email && current.name === input.name) {
      return current
    }
    return yield* writer.update({
      email: input.email,
      etag: current.etag,
      id: current.id,
      name: input.name,
    })
  })

  return { ...base, provision, reconcile }
})

/** Governed User records plus trusted JIT provisioning for identity adapters. */
export class UserService extends Context.Service<UserService>()(
  "@company/UserService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
