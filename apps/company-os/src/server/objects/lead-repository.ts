import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/object-repository"

export class LeadRepository extends Context.Service<LeadRepository>()(
  "@company/LeadRepository",
  {
    make: makeObjectRepository(Model.objects.lead),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
