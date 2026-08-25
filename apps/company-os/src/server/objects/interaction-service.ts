import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { InteractionRepository } from "./interaction-repository"
import { makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repository = yield* InteractionRepository
  return yield* makeObjectService(Model.objects.interaction, repository)
})

/** Governed queries and actions for interaction objects. */
export class InteractionService extends Context.Service<InteractionService>()(
  "@company/InteractionService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
