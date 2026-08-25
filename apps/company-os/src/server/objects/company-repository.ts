import { Model } from "@company/model"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage"

export class CompanyRepository extends Context.Service<CompanyRepository>()(
  "@company/CompanyRepository",
  {
    make: makeObjectRepository(Model.objects.company),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
