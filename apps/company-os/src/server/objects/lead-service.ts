import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { LeadRepository } from "./lead-repository"
import { makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repository = yield* LeadRepository
  return yield* makeObjectService(Model.objects.lead, repository)
})

/** Governed queries and actions for lead objects. */
export class LeadService extends Context.Service<LeadService>()(
  "@company/LeadService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
