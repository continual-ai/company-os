import type { RecordId } from "@company/runtime/model"
import { Records } from "@company/runtime/server"
import { Effect } from "effect"

import { Ticket } from "#/modules/support/model/ticket.ts"

export const seedSupportPerformance = Effect.fn(
  "@company/seedSupportPerformance"
)(function* (input: {
  readonly companies: ReadonlyArray<RecordId<"company">>
  readonly contacts: ReadonlyArray<RecordId<"contact">>
}) {
  const records = yield* Records
  const services = { ticket: records.writer(Ticket) }
  for (let index = 0; index < Math.ceil(input.contacts.length / 4); index++)
    yield* services.ticket.create({
      subject: `Scale support request ${String(index + 1).padStart(5, "0")}`,
      company: input.companies[0]!,
      requester: input.contacts[index]!,
      status: (["new", "open", "waitingOnTeam", "resolved"] as const)[
        index % 4
      ]!,
      priority: (["normal", "low", "high", "urgent"] as const)[index % 4]!,
      description:
        "A realistic support queue for checking filters, counts, pagination, and relationship views.",
    })
})
