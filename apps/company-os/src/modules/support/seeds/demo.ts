import { Effect } from "effect"

import { Reply } from "#/modules/support/model/reply.ts"
import { Ticket } from "#/modules/support/model/ticket.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Records } from "#/runtime/server/index.ts"

export const seedSupportDemo = Effect.fn("@company/seedSupportDemo")(
  function* (customer: {
    readonly company: RecordId<"company">
    readonly contact: RecordId<"contact">
    readonly owner: RecordId<"user">
  }) {
    const records = yield* Records
    const services = {
      ticket: records.writer(Ticket),
      reply: records.writer(Reply),
    }
    const ticket = yield* services.ticket.create({
      subject: "New teammates cannot accept expired invitations",
      status: "waitingOnTeam",
      priority: "high",
      description:
        "Maya invited the operations team last week. Several links expired before the team could finish setup.",
      links: {
        company: [customer.company],
        requester: [customer.contact],
        owner: [customer.owner],
      },
    })
    yield* services.reply.create({
      subject: "Invitation recovery",
      direction: "inbound",
      status: "received",
      body: "Could you help us get the remaining teammates into the pilot? Their invitation links expired.",
      links: { ticket: [ticket.id] },
    })
    yield* services.reply.create({
      subject: "Engineering follow-up",
      direction: "internal",
      body: "Linked the recovery issue. Follow up after the fix is verified.",
      links: { ticket: [ticket.id] },
    })
    yield* services.ticket.create({
      subject: "Confirm export format",
      status: "resolved",
      resolution: "Shared a sample CSV and confirmed the column mapping.",
      links: {
        company: [customer.company],
        requester: [customer.contact],
        owner: [customer.owner],
      },
    })
    return { ticket: ticket.id }
  }
)
