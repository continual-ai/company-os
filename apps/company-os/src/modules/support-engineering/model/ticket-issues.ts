import { Issue } from "#/modules/engineering/model/index.ts"
import { Ticket } from "#/modules/support/model/index.ts"
import { defineLink } from "#/runtime/model/index.ts"
export const TicketIssues = defineLink({
  id: "ticketIssues",
  name: "Engineering issues",
  from: Ticket,
  to: Issue,
  forward: {
    key: "issues",
    label: "Engineering issues",
    min: 0,
  },
  reverse: {
    key: "tickets",
    label: "Customer tickets",
    min: 0,
  },
})
