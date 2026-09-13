import { Reply, ReplyTicket } from "#/modules/service/model/reply.ts"
import {
  Ticket,
  TicketAccount,
  TicketOwner,
  TicketRequester,
} from "#/modules/service/model/ticket.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const ServiceModule = defineModule({
  maturity: "alpha",
  origin: {
    name: "Company OS",
    url: "https://github.com/continual-ai/company-os",
  },
  description: "Track customer requests, replies, and resolution.",
  id: "service",
  name: "Service",
  objects: [Ticket, Reply],
  links: [ReplyTicket, TicketAccount, TicketRequester, TicketOwner],
})

export { Ticket }
