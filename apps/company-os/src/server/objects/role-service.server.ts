import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { makeObjectService } from "./object-service.server"
import { RoleRepository } from "./role-repository.server"

const make = Effect.gen(function* () {
  const repository = yield* RoleRepository
  return yield* makeObjectService(AcmeModel.objects.role, repository)
})

export class RoleService extends Context.Service<RoleService>()(
  "@acme/RoleService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
