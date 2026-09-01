import { Model } from "@company/model"
import {
  RecordId,
  type ObjectCreateInput,
  type ObjectRecord,
} from "@company/runtime"
import type { ObjectInsert } from "@company/runtime/effect/object-repository"
import { Context, Effect, Layer } from "effect"

import { currentActorId } from "@/server/invocation-context"
import { ObjectRepositories } from "@/server/model/object-repositories"
import {
  makeBaseObjectService,
  makeObjectWriter,
} from "@/server/model/object-service"
import { ROOT_ID } from "@/system-records"

type UserRecord = ObjectRecord<(typeof Model.objects)["user"]>
type UserCreateInput = ObjectCreateInput<(typeof Model.objects)["user"]>

const make = Effect.gen(function* () {
  const repository = (yield* ObjectRepositories).user
  const base = yield* makeBaseObjectService(Model.objects.user, repository)
  const writer = yield* makeObjectWriter(Model.objects.user, repository)

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
      } satisfies ObjectInsert<(typeof Model.objects)["user"]>)
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
