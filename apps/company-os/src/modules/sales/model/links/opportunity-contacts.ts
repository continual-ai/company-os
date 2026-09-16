import { Contact } from "#/modules/crm/model/index.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const OpportunityContacts = defineLink({
  id: "opportunityContacts",
  name: "Opportunity contacts",
  from: { object: Opportunity, key: "contacts", label: "Contacts" },
  to: { object: Contact, key: "opportunities", label: "Opportunities" },
})
