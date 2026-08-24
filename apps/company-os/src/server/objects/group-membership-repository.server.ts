import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class GroupMembershipRepository extends Context.Service<GroupMembershipRepository>()(
  "@acme/GroupMembershipRepository",
  { make: makeObjectRepository(AcmeModel.objects.groupMembership) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
