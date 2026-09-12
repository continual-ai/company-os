import {
  Activity,
  ActivityCompany,
  ActivityContact,
  ActivityDeal,
  ActivityOwner,
} from "#/modules/sales/model/activity.ts"
import { Company } from "#/modules/sales/model/company.ts"
import { Contact } from "#/modules/sales/model/contact.ts"
import {
  Deal,
  DealOwner,
  PipelineSummaryQuery,
} from "#/modules/sales/model/deal.ts"
import { Party } from "#/modules/sales/model/interfaces/party.ts"
import {
  Lead,
  LeadCompany,
  ConvertLeaded,
  ConvertLeadedCompany,
  ConvertLeadedContact,
  ConvertLead,
} from "#/modules/sales/model/lead.ts"
import { DealLineItems, LineItem } from "#/modules/sales/model/line-item.ts"
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
  events: [ConvertLeaded],
  links: [
    DealLineItems,
    ContactCompanies,
    ContactPrimaryCompany,
    DealCompanies,
    ActivityCompany,
    ActivityContact,
    ActivityDeal,
    ActivityOwner,
    DealOwner,
    LeadCompany,
    ConvertLeadedCompany,
    ConvertLeadedContact,
  ],
  objects: [Activity, Company, Contact, Lead, Deal, LineItem],
  queries: [PipelineSummaryQuery],
  actions: [ConvertLead],
})

export { ConvertLeaded } from "#/modules/sales/model/lead.ts"

export { Activity, Company, Contact, Deal, Lead, LineItem, Party }
