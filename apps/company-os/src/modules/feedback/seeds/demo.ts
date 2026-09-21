import { Effect } from "effect"

import { Feedback } from "#/modules/feedback/model/index.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

export const seedFeedbackDemo = Effect.fn("@company/seedFeedbackDemo")(
  function* (context: {
    readonly owner: RecordId<"user">
    readonly contact: RecordId<"contact">
    readonly ticket: RecordId<"ticket">
    readonly task: RecordId<"task">
  }) {
    const feedback = (yield* Database).repository(Feedback)
    yield* feedback.create({
      title: "Expired invitations interrupt team onboarding",
      description:
        "Several teammates could not finish setup after their invitation links expired. They need a way to resume without asking an administrator to start again.",
      source: "Customer support",
      status: "reviewed",
      reviewNotes:
        "Linked the invitation recovery task. Verify the recovery flow with the reporter after the work is complete.",
      links: {
        owner: context.owner,
        reporter: context.contact,
        tickets: [context.ticket],
        tasks: [context.task],
      },
    })
    yield* feedback.create({
      title: "Panel access may make servicing difficult",
      description:
        "During the workshop walk-through, the maintenance team reported that the proposed access cover may be difficult to remove when nearby equipment is installed.",
      source: "Workshop field inspection",
      links: { owner: context.owner },
    })
  }
)
