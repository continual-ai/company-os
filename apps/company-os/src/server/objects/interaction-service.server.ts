import { AcmeModel } from "@acme/api"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization.server"

import { InteractionRepository } from "./interaction-repository.server"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* InteractionRepository

  return ObjectService.make(AcmeModel.objects.interaction, repository, {
    authorize: authorization.require,
  })
})

export class InteractionService extends Context.Service<InteractionService>()(
  "@acme/InteractionService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
