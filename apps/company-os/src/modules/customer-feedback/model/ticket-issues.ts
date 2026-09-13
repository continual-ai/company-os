import { Issue } from "#/modules/product/model/index.ts"
import { Ticket } from "#/modules/service/model/index.ts"
import { defineLink } from "#/runtime/model/index.ts"
export const TicketIssues = defineLink({
  id: "ticketIssues",
  name: "Customer reported issues",
  from: { type: Ticket, key: "issues", label: "Product issues", min: 0 },
  to: { type: Issue, key: "tickets", label: "Customer tickets", min: 0 },
})
