import { Model } from "@company/model"
import { Context, Effect, Layer } from "effect"

import { makeObjectService } from "./object-service"
import { ServiceAccountRepository } from "./service-account-repository"

const make = Effect.gen(function* () {
  const repository = yield* ServiceAccountRepository
  return yield* makeObjectService(Model.objects.serviceAccount, repository)
})

export class ServiceAccountService extends Context.Service<ServiceAccountService>()(
  "@company/ServiceAccountService",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}
