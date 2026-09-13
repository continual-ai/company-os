import { Effect } from "effect"

import { Reply } from "#/modules/service/model/reply.ts"
import { Ticket } from "#/modules/service/model/ticket.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

export const seedServiceDemo = Effect.fn("@company/seedServiceDemo")(
  function* (customer: {
    readonly account: RecordId<"account">
    readonly contact: RecordId<"contact">
    readonly owner: RecordId<"user">
  }) {
    const records = yield* Database
    const services = {
      ticket: records.repository(Ticket),
      reply: records.repository(Reply),
    }
    const ticket = yield* services.ticket.create({
      subject: "New teammates cannot accept expired invitations",
      status: "waitingOnTeam",
      priority: "high",
      description:
        "Maya invited the operations team last week. Several links expired before the team could finish setup.",
      links: {
        account: customer.account,
        requester: customer.contact,
        owner: customer.owner,
      },
    })
    yield* services.reply.create({
      subject: "Invitation recovery",
      direction: "inbound",
      status: "received",
      body: "Could you help us get the remaining teammates into the pilot? Their invitation links expired.",
      links: { ticket: ticket.id },
    })
    yield* services.reply.create({
      subject: "Engineering follow-up",
      direction: "internal",
      body: "Linked the recovery issue. Follow up after the fix is verified.",
      links: { ticket: ticket.id },
    })
    yield* services.ticket.create({
      subject: "Confirm export format",
      status: "resolved",
      resolution: "Shared a sample CSV and confirmed the column mapping.",
      links: {
        account: customer.account,
        requester: customer.contact,
        owner: customer.owner,
      },
    })
    return { ticket: ticket.id }
  }
)
