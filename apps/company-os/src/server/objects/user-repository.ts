import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class UserRepository extends Context.Service<UserRepository>()(
  "@company/UserRepository",
  { make: makeObjectRepository(Model.objects.user) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
