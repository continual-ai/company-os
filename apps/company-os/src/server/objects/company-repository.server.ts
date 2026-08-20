import { AcmeModel } from "@acme/api"
import { Context, Layer } from "effect"

import * as ObjectRepository from "@/server/database/object-repository.server"
import { companies } from "@/server/database/schema/companies"

export class CompanyRepository extends Context.Service<CompanyRepository>()(
  "@acme/CompanyRepository",
  { make: ObjectRepository.make(AcmeModel.objects.company, companies) }
) {
  static readonly layer = Layer.effect(this, this.make)
}
