import { defineModule } from "@company/runtime/model"

import { Activity } from "#/model/activity.ts"
import { Company } from "#/model/company.ts"
import { Contact } from "#/model/contact.ts"
import { Deal } from "#/model/deal.ts"
import { Party } from "#/model/interfaces/party.ts"
import { Lead, LeadConverted } from "#/model/lead.ts"
import { LineItem } from "#/model/line-item.ts"
import { ContactCompanies } from "#/model/links/contact-companies.ts"
import { ContactPrimaryCompany } from "#/model/links/contact-primary-company.ts"
import { DealCompanies } from "#/model/links/deal-companies.ts"

export const SalesModule = defineModule({
  id: "sales",
  requires: ["access", "notes"],
  name: "Sales",
  interfaces: [Party],
  events: [LeadConverted],
  links: [ContactCompanies, ContactPrimaryCompany, DealCompanies],
  objects: [Activity, Company, Contact, Lead, Deal, LineItem],
})

export { LeadConverted } from "#/model/lead.ts"

export { Deal, Contact, LineItem, Activity, Lead, Party, Company }
