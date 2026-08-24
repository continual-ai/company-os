import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { makeObjectService } from "./object-service.server"
import { UserRepository } from "./user-repository.server"

const make = Effect.gen(function* () {
  const repository = yield* UserRepository
  return yield* makeObjectService(AcmeModel.objects.user, repository)
})

export class UserService extends Context.Service<UserService>()(
  "@acme/UserService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
