import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class ServiceAccountRepository extends Context.Service<ServiceAccountRepository>()(
  "@company/ServiceAccountRepository",
  { make: makeObjectRepository(Model.objects.serviceAccount) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
