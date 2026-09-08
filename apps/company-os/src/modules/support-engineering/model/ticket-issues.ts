import { Issue } from "@company/engineering/model"
import { defineLink } from "@company/runtime/model"

import { Ticket } from "#/modules/support/model/index.ts"
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
