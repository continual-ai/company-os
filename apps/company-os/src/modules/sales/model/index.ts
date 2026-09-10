import { Activity } from "#/modules/sales/model/activity.ts"
import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import { Deal } from "#/modules/sales/model/deal.ts"
import { Party } from "#/modules/sales/model/interfaces/party.ts"
import { Lead, LeadConverted } from "#/modules/sales/model/lead.ts"
import { LineItem } from "#/modules/sales/model/line-item.ts"
import { ContactCompanies } from "#/modules/sales/model/links/contact-companies.ts"
import { ContactPrimaryCompany } from "#/modules/sales/model/links/contact-primary-company.ts"
import { DealCompanies } from "#/modules/sales/model/links/deal-companies.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const SalesModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Track companies, contacts, leads, and deals.",
  id: "sales",
  name: "Sales",
  interfaces: [Party],
  events: [LeadConverted],
  links: [ContactCompanies, ContactPrimaryCompany, DealCompanies],
  objects: [Activity, Company, Contact, Lead, Deal, LineItem],
})

export { LeadConverted } from "#/modules/sales/model/lead.ts"

export { Deal, Contact, LineItem, Activity, Lead, Party, Company }
