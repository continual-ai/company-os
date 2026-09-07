import type { RecordId } from "@company/runtime"
import { Effect } from "effect"

import { ModelImplementation } from "@/server/model/model-implementation"

export const seedSupportPerformance = Effect.fn(
  "@company/seedSupportPerformance"
)(function* (input: {
  readonly companies: ReadonlyArray<RecordId<"company">>
  readonly contacts: ReadonlyArray<RecordId<"contact">>
}) {
  const { services } = yield* ModelImplementation
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
