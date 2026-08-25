import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage"

export class GroupMembershipRepository extends Context.Service<GroupMembershipRepository>()(
  "@company/GroupMembershipRepository",
  { make: makeObjectRepository(Model.objects.groupMembership) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
