import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { GroupRepository } from "./group-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* GroupRepository
  return yield* makeObjectService(Model.objects.group, repository)
})

export class GroupService extends Context.Service<GroupService>()(
  "@company/GroupService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
