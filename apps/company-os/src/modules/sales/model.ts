import { defineModule } from "@company/runtime"

import { Activity } from "#/modules/sales/activity/model.ts"
import { Company } from "#/modules/sales/company/model.ts"
import { Contact } from "#/modules/sales/contact/model.ts"
import { Deal } from "#/modules/sales/deal/model.ts"
import { Party } from "#/modules/sales/interfaces/party.ts"
import { Lead } from "#/modules/sales/lead/model.ts"
import { LineItem } from "#/modules/sales/line-item/model.ts"
import { ContactCompanies } from "#/modules/sales/links/contact-companies.ts"
import { ContactPrimaryCompany } from "#/modules/sales/links/contact-primary-company.ts"
import { DealCompanies } from "#/modules/sales/links/deal-companies.ts"

export const SalesModule = defineModule({
  id: "sales",
  name: "Sales",
  interfaces: [Party],
  links: [ContactCompanies, ContactPrimaryCompany, DealCompanies],
  objects: [Activity, Company, Contact, Lead, Deal, LineItem],
})
