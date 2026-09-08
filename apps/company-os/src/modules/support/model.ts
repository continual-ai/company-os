import { defineModule } from "@company/runtime"

import { TicketIssues } from "#/modules/support/links/ticket-issues.ts"
import { Reply } from "#/modules/support/reply/model.ts"
import { Ticket } from "#/modules/support/ticket/model.ts"
export const SupportModule = defineModule({
  id: "support",
  name: "Support",
  interfaces: [],
  links: [TicketIssues],
  objects: [Ticket, Reply],
})
