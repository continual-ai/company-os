import { Reply } from "#/modules/support/model/reply.ts"
import { Ticket } from "#/modules/support/model/ticket.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const SupportModule = defineModule({
  description: "Track customer requests, replies, and resolution.",
  id: "support",
  name: "Support",
  objects: [Ticket, Reply],
})

export { Ticket }
