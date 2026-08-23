import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { CompanyRepository } from "./company-repository.server"
import { makeObjectService } from "./object-service.server"

const make = Effect.gen(function* () {
  const repository = yield* CompanyRepository
  return yield* makeObjectService(AcmeModel.objects.company, repository)
})

/** Governed queries and actions for Acme company objects. */
export class CompanyService extends Context.Service<CompanyService>()(
  "@acme/CompanyService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
