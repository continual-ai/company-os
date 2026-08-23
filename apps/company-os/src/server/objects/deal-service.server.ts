import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { DealRepository } from "./deal-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* DealRepository
  return yield* makeObjectService(AcmeModel.objects.deal, repository)
})

/** Governed queries and actions for Acme deal objects. */
export class DealService extends Context.Service<DealService>()(
  "@acme/DealService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
