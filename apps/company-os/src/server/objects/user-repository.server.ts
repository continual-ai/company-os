import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class UserRepository extends Context.Service<UserRepository>()(
  "@acme/UserRepository",
  { make: makeObjectRepository(AcmeModel.objects.user) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
