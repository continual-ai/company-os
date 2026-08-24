import { AcmeModel } from "@acme/api"
import { Context, Effect, Layer } from "effect"

import { makeObjectService } from "./object-service.server"
import { ServiceAccountRepository } from "./service-account-repository.server"

const make = Effect.gen(function* () {
  const repository = yield* ServiceAccountRepository
  return yield* makeObjectService(AcmeModel.objects.serviceAccount, repository)
})

export class ServiceAccountService extends Context.Service<ServiceAccountService>()(
  "@acme/ServiceAccountService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
