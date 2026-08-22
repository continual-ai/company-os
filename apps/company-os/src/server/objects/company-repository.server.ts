import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import { makeObjectRepository } from "@/server/database/model-storage.server"

export class CompanyRepository extends Context.Service<CompanyRepository>()(
  "@acme/CompanyRepository",
  {
    make: makeObjectRepository(AcmeModel.objects.company),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
