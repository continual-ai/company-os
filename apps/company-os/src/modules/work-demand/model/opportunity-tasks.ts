import { Opportunity } from "#/modules/sales/model/index.ts"
import { Task } from "#/modules/work/model/index.ts"
import { defineLink } from "#/runtime/model/index.ts"

export const OpportunityTasks = defineLink({
  id: "opportunityTasks",
  name: "Opportunity work",
  from: { object: Opportunity, key: "tasks", label: "Required tasks" },
  to: { object: Task, key: "opportunities", label: "Opportunities" },
})
