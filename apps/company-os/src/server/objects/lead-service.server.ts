import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { LeadRepository } from "./lead-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* LeadRepository
  return yield* makeObjectService(AcmeModel.objects.lead, repository)
})

/** Governed queries and actions for Acme lead objects. */
export class LeadService extends Context.Service<LeadService>()(
  "@acme/LeadService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
