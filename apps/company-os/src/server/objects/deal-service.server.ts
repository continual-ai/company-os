import { AcmeModel } from "@acme/api"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization.server"

import { DealRepository } from "./deal-repository.server"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* DealRepository

  return ObjectService.make(AcmeModel.objects.deal, repository, {
    authorize: authorization.require,
  })
})

/** Governed operations for Acme deal objects. */
export class DealService extends Context.Service<DealService>()(
  "@acme/DealService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
