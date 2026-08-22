import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class LeadRepository extends Context.Service<LeadRepository>()(
  "@acme/LeadRepository",
  {
    make: makeObjectRepository(AcmeModel.objects.lead),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
