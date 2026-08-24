import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class ServiceAccountRepository extends Context.Service<ServiceAccountRepository>()(
  "@acme/ServiceAccountRepository",
  { make: makeObjectRepository(AcmeModel.objects.serviceAccount) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
