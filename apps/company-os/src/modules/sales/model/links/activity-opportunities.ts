import { Activity } from "#/modules/crm/model/index.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const ActivityOpportunities = defineLink({
  id: "activityOpportunities",
  name: "Activity Opportunity",
  from: { object: Activity, key: "opportunities", label: "Opportunities" },
  to: { object: Opportunity, key: "activities", label: "Activities" },
})
