import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { GroupMembershipRepository } from "./group-membership-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* GroupMembershipRepository
  return yield* makeObjectService(AcmeModel.objects.groupMembership, repository)
})

export class GroupMembershipService extends Context.Service<GroupMembershipService>()(
  "@acme/GroupMembershipService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
