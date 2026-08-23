import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { InteractionRepository } from "./interaction-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* InteractionRepository
  return yield* makeObjectService(AcmeModel.objects.interaction, repository)
})

/** Governed queries and actions for Acme interaction objects. */
export class InteractionService extends Context.Service<InteractionService>()(
  "@acme/InteractionService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
