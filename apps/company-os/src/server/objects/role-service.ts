import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { makeObjectService } from "./object-service"
import { RoleRepository } from "./role-repository"

const make = Effect.gen(function* () {
  const repository = yield* RoleRepository
  return yield* makeObjectService(Model.objects.role, repository)
})

export class RoleService extends Context.Service<RoleService>()(
  "@company/RoleService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
