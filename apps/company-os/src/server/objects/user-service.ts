import { Model } from "@company/model"
import { RecordId, type ObjectRecord } from "@company/runtime"
import { generateRecordId } from "@company/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { currentActorId } from "@/server/invocation-context"
import { PLATFORM_ID } from "@/system-records"

import { makeObjectService } from "./object-service"
import { UserRepository } from "./user-repository"

type UserRecord = ObjectRecord<(typeof Model.objects)["user"]>

const make = Effect.gen(function* () {
  const repository = yield* UserRepository
  const base = yield* makeObjectService(Model.objects.user, repository)

  const provision = Effect.fn("@company/UserService.provision")(function* (
    input: Pick<UserRecord, "email" | "name"> &
      Partial<Pick<UserRecord, "image">>
  ) {
    const actorId = yield* currentActorId
    return yield* repository.insert({
      aliases: [],
      createdBy: actorId,
      email: input.email,
      id: RecordId("user")(generateRecordId("user")),
      image: input.image ?? null,
      metadata: {},
      name: input.name,
      parent: PLATFORM_ID,
      status: "active",
      systemManaged: false,
      updatedBy: actorId,
    })
  })

  return { ...base, provision }
})

/** Governed User records plus trusted JIT provisioning for identity adapters. */
export class UserService extends Context.Service<UserService>()(
  "@company/UserService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
