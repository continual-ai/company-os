import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class PrincipalSetRepository extends Context.Service<PrincipalSetRepository>()(
  "@company/PrincipalSetRepository",
  { make: makeObjectRepository(Model.objects.principalSet) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
