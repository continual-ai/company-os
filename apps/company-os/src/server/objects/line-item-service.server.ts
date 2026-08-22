import { AcmeModel } from "@acme/api"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization.server"

import { LineItemRepository } from "./line-item-repository.server"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* LineItemRepository

  return ObjectService.make(AcmeModel.objects.lineItem, repository, {
    authorize: authorization.require,
  })
})

/** Governed operations for Acme deal line items. */
export class LineItemService extends Context.Service<LineItemService>()(
  "@acme/LineItemService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
