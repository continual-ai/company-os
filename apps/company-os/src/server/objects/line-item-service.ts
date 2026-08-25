import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { LineItemRepository } from "./line-item-repository"
import { makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repository = yield* LineItemRepository
  return yield* makeObjectService(Model.objects.lineItem, repository)
})

/** Governed queries and actions for deal line items. */
export class LineItemService extends Context.Service<LineItemService>()(
  "@company/LineItemService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
