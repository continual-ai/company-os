import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class LineItemRepository extends Context.Service<LineItemRepository>()(
  "@company/LineItemRepository",
  { make: makeObjectRepository(Model.objects.lineItem) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
