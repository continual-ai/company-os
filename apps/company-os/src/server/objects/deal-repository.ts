import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class DealRepository extends Context.Service<DealRepository>()(
  "@company/DealRepository",
  { make: makeObjectRepository(Model.objects.deal) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
