import { Account } from "#/modules/crm/model/account.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const OpportunityAccounts = defineLink({
  id: "opportunityAccounts",
  name: "Opportunity accounts",
  from: { type: Opportunity, key: "accounts", min: 0, label: "Accounts" },
  to: { type: Account, key: "opportunities", min: 0, label: "Opportunities" },
})
