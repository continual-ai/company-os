import { Model } from "@company/model"
import {
  RecordId,
  type ObjectRecord,
  type RecordIdentifier,
} from "@company/runtime"
import { generateRecordId } from "@company/runtime/effect/object-service"
import { Context, Data, Effect, Layer } from "effect"

import { IdentityBindingRepository } from "@/server/auth/identity-binding-repository"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { currentActorId } from "@/server/invocation-context"
import { PLATFORM_ID } from "@/system-records"

import { makeObjectService } from "./object-service"
import { RecordIdentifierResolver } from "./record-identifier-resolver"
import { UserRepository } from "./user-repository"

class LastActivePlatformAdministrator extends Data.TaggedError(
  "LastActivePlatformAdministrator"
)<{}> {}

type UserRecord = ObjectRecord<(typeof Model.objects)["user"]>

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const database = yield* Database
  const identityBindings = yield* IdentityBindingRepository
  const identifiers = yield* RecordIdentifierResolver
  const repository = yield* UserRepository
  const base = yield* makeObjectService(Model.objects.user, repository)

  const resolveId = Effect.fn("@company/UserService.resolveId")(function* (
    identifier: RecordIdentifier<"user">
  ) {
    return yield* identifiers.resolve("user", identifier)
  })

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

  const setStatus = Effect.fn("@company/UserService.setStatus")(function* (
    identifier: RecordIdentifier<"user">,
    status: UserRecord["status"]
  ) {
    const id = yield* resolveId(identifier)
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        yield* authorization.requireAction({
          actionId: status === "active" ? "reactivate" : "suspend",
          objectType: "user",
          recordIds: [id],
        })
        const user = yield* repository.get(id)
        if (user.status === status) return user
        if (
          status === "suspended" &&
          (yield* identityBindings.isLastActivePlatformAdministrator(id))
        ) {
          return yield* Effect.fail(new LastActivePlatformAdministrator())
        }
        const updated = yield* repository.update({
          etag: user.etag,
          id,
          status,
          updatedBy: yield* currentActorId,
        })
        if (status === "suspended") {
          yield* identityBindings.revokeSessions(id)
        }
        return updated
      })
    )
  })

  const suspend = Effect.fn("@company/UserService.suspend")(function* (
    identifier: RecordIdentifier<"user">
  ) {
    return yield* setStatus(identifier, "suspended")
  })

  const reactivate = Effect.fn("@company/UserService.reactivate")(function* (
    identifier: RecordIdentifier<"user">
  ) {
    return yield* setStatus(identifier, "active")
  })

  return { ...base, provision, reactivate, suspend }
})

export class UserService extends Context.Service<UserService>()(
  "@company/UserService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
