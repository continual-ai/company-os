import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class LineItemRepository extends Context.Service<LineItemRepository>()(
  "@acme/LineItemRepository",
  { make: makeObjectRepository(AcmeModel.objects.lineItem) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
