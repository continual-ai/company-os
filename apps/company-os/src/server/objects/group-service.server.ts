import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { GroupRepository } from "./group-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* GroupRepository
  return yield* makeObjectService(AcmeModel.objects.group, repository)
})

export class GroupService extends Context.Service<GroupService>()(
  "@acme/GroupService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
