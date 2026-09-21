import { Effect } from "effect"

import type { CrmSeedData } from "#/modules/crm/seeds/index.ts"
import { Feedback } from "#/modules/feedback/model/index.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

export const seedFeedbackPerformance = Effect.fn(
  "@company/seedFeedbackPerformance"
)(function* (
  { customers }: CrmSeedData,
  tasks: ReadonlyArray<RecordId<"task">>
) {
  const feedback = (yield* Database).repository(Feedback)
  for (const [index, customer] of customers.entries()) {
    const task = index % 3 === 0 ? tasks[index % tasks.length] : undefined
    yield* feedback.create({
      title: `Onboarding observations from ${customer.accountName} — ${customer.name}`,
      description:
        "The team needs clearer guidance about the next step during setup.",
      source: "Customer interview",
      status: task ? "reviewed" : "new",
      reviewNotes: task
        ? "Linked existing work to investigate the reported friction."
        : null,
      links: {
        reporter: customer.contact,
        owner: customer.owner,
        tasks: task ? [task] : [],
      },
    })
  }
})
