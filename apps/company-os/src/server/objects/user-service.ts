import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { makeObjectService } from "./object-service"
import { UserRepository } from "./user-repository"

const make = Effect.gen(function* () {
  const repository = yield* UserRepository
  return yield* makeObjectService(Model.objects.user, repository)
})

export class UserService extends Context.Service<UserService>()(
  "@company/UserService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
