import { defineModule } from "@company/runtime/model"

import { Reply } from "#/modules/support/model/reply.ts"
import { Ticket } from "#/modules/support/model/ticket.ts"
export const SupportModule = defineModule({
  id: "support",
  requires: ["sales", "notes"],
  name: "Support",
  interfaces: [],
  links: [],
  objects: [Ticket, Reply],
})

export { Ticket }
