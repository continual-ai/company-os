import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage"

export class GroupRepository extends Context.Service<GroupRepository>()(
  "@company/GroupRepository",
  { make: makeObjectRepository(Model.objects.group) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
