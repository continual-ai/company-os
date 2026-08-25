import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { CompanyRepository } from "./company-repository"
import { makeObjectService } from "./object-service"

const make = Effect.gen(function* () {
  const repository = yield* CompanyRepository
  return yield* makeObjectService(Model.objects.company, repository)
})

/** Governed queries and actions for company objects. */
export class CompanyService extends Context.Service<CompanyService>()(
  "@company/CompanyService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
