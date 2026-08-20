import { AcmeModel } from "@acme/api"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization.server"

import { LeadRepository } from "./lead-repository.server"

const Lead = AcmeModel.objects.lead

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* LeadRepository
  const findByEmail = Effect.fn("lead.findByEmail")(function* (email: string) {
    yield* authorization.require({ objectId: Lead.id, operation: "list" })
    return yield* repository.findByEmail(email)
  })

  return {
    ...ObjectService.make(Lead, repository, {
      authorize: authorization.require,
    }),
    findByEmail,
  }
})

/** Governed operations and object-specific queries for Acme lead objects. */
export class LeadService extends Context.Service<LeadService>()(
  "@acme/LeadService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
