import {
  Lead,
  LeadAccount,
  LeadOwner,
  LeadConverted,
  LeadContact,
  LeadOpportunity,
  ConvertLead,
} from "#/modules/sales/model/lead.ts"
import {
  OpportunityLineItems,
  LineItem,
} from "#/modules/sales/model/line-item.ts"
import { ActivityOpportunities } from "#/modules/sales/model/links/activity-opportunities.ts"
import { OpportunityAccounts } from "#/modules/sales/model/links/opportunity-accounts.ts"
import { OpportunityContacts } from "#/modules/sales/model/links/opportunity-contacts.ts"
import {
  Opportunity,
  OpportunityOwner,
  PipelineSummaryQuery,
} from "#/modules/sales/model/opportunity.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const SalesModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description:
    "Qualify leads, manage opportunities, and coordinate sales follow-up.",
  id: "sales",
  name: "Sales",
  events: [LeadConverted],
  links: [
    OpportunityLineItems,
    OpportunityAccounts,
    OpportunityContacts,
    ActivityOpportunities,
    OpportunityOwner,
    LeadAccount,
    LeadOwner,
    LeadContact,
    LeadOpportunity,
  ],
  objects: [Lead, Opportunity, LineItem],
  queries: [PipelineSummaryQuery],
  actions: [ConvertLead],
})

export { LeadConverted } from "#/modules/sales/model/lead.ts"

export { Opportunity, Lead, LineItem }
