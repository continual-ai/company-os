import { defineLink } from "@company/runtime"

import { Issue } from "#/modules/engineering/issue/model.ts"
import { Ticket } from "#/modules/support/ticket/model.ts"
export const TicketIssues = defineLink({
  id: "ticketIssues",
  name: "Engineering issues",
  writeFrom: "issues",
  forward: {
    from: Ticket,
    to: Issue,
    key: "issues",
    label: "Engineering issues",
    cardinality: "many",
  },
  reverse: {
    from: Issue,
    to: Ticket,
    key: "tickets",
    label: "Customer tickets",
    cardinality: "many",
  },
})
