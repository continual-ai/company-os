import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class RoleRepository extends Context.Service<RoleRepository>()(
  "@acme/RoleRepository",
  { make: makeObjectRepository(AcmeModel.objects.role) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
