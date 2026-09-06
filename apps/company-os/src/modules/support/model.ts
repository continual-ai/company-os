import { defineModule } from "@company/runtime"

import { TicketIssues } from "./links/ticket-issues"
import { Reply } from "./reply/model"
import { Ticket } from "./ticket/model"
export const SupportModule = defineModule({
  id: "support",
  name: "Support",
  interfaces: [],
  links: [TicketIssues],
  objects: [Ticket, Reply],
})
