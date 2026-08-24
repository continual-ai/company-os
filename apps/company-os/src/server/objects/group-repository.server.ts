import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class GroupRepository extends Context.Service<GroupRepository>()(
  "@acme/GroupRepository",
  { make: makeObjectRepository(AcmeModel.objects.group) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
