import { AcmeModel } from "@acme/api"
import * as ObjectService from "@continual/runtime/effect/object-service"
import { Context, Effect, Layer } from "effect"

import { Authorization } from "@/server/authorization.server"

import { CompanyRepository } from "./company-repository.server"

const make = Effect.gen(function* () {
  const authorization = yield* Authorization
  const repository = yield* CompanyRepository

  return ObjectService.make(AcmeModel.objects.company, repository, {
    authorize: authorization.require,
  })
})

/** Governed operations for Acme company objects. */
export class CompanyService extends Context.Service<CompanyService>()(
  "@acme/CompanyService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
