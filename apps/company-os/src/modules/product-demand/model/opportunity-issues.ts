import { Issue } from "#/modules/product/model/index.ts"
import { Opportunity } from "#/modules/sales/model/index.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const OpportunityIssues = defineLink({
  id: "opportunityIssues",
  name: "Opportunity product needs",
  from: { object: Opportunity, key: "issues", label: "Product needs" },
  to: { object: Issue, key: "opportunities", label: "Opportunities" },
})
