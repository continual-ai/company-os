import { TicketIssues } from "#/modules/customer-feedback/model/ticket-issues.ts"
import { defineModule } from "#/runtime/model/index.ts"

export const CustomerFeedbackModule = defineModule({
  id: "customerFeedback",
  name: "Customer feedback",
  description:
    "Connect customer service reports to the product work that addresses them.",
  maturity: "alpha",
  links: [TicketIssues],
})
