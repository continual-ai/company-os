import { OpportunityTasks } from "#/modules/work-demand/model/opportunity-tasks.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const WorkDemandModule = defineModule({
  id: "workDemand",
  name: "Work demand",
  description: "Connect sales opportunities to the work they need.",
  maturity: "alpha",
  links: [OpportunityTasks],
})
