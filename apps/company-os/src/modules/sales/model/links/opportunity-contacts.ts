import { Contact } from "#/modules/crm/model/index.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const OpportunityContacts = defineLink({
  id: "opportunityContacts",
  name: "Opportunity contacts",
  from: { type: Opportunity, key: "contacts", label: "Contacts" },
  to: { type: Contact, key: "opportunities", label: "Opportunities" },
})
