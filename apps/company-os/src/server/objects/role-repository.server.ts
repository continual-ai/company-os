import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class RoleRepository extends Context.Service<RoleRepository>()(
  "@company/RoleRepository",
  { make: makeObjectRepository(Model.objects.role) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
