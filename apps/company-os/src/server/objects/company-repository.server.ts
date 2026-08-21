import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import * as ObjectRepository from "@/server/database/object-repository.server"
import { companies } from "@/server/database/schema/companies"
import { parties } from "@/server/database/schema/parties"

export class CompanyRepository extends Context.Service<CompanyRepository>()(
  "@acme/CompanyRepository",
  {
    make: ObjectRepository.make(AcmeModel.objects.company, companies, {
      interfaceTables: [parties],
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
