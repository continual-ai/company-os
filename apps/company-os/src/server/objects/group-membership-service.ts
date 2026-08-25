import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { GroupMembershipRepository } from "./group-membership-repository"
import { makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repository = yield* GroupMembershipRepository
  return yield* makeObjectService(Model.objects.groupMembership, repository)
})

export class GroupMembershipService extends Context.Service<GroupMembershipService>()(
  "@company/GroupMembershipService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
