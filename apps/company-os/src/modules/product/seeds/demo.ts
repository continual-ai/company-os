import { Effect } from "effect"

import { Note } from "#/modules/notes/model/index.ts"
import { Issue, Project } from "#/modules/product/model/index.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const seedProductDemo = Effect.fn("@company/seedProductDemo")(
  function* ({ owner }: { readonly owner: RecordId<"user"> }) {
    const records = yield* Database
    const services = {
      project: records.repository(Project),
      issue: records.repository(Issue),
      note: records.repository(Note),
    }
    const project = yield* services.project.create({
      name: "Customer onboarding",
      objective: "Make account setup reliable for every new customer.",
      status: "active",
      links: { owner: owner },
    })
    const issues = yield* Effect.forEach(
      [
        ["Recover expired invitations", "inProgress", "high"],
        ["Show import progress for large contact lists", "planned", "normal"],
        ["Preserve filters when returning from a record", "done", "normal"],
      ] as const,
      ([title, status, priority]) =>
        services.issue.create({
          title,
          status,
          priority,
          description:
            "Reported during Northstar's pilot. Keep the user in context and make the next step clear.",
          links: { project: project.id, assignee: owner },
        })
    )
    const note = yield* services.note.create({
      content:
        "### Recovery behavior\n\nKeep the original invitation context. Let the user request a fresh link without starting over.\n\n```text\nexpired → request new link → resume onboarding\n```",
    })
    yield* linkSeedRecords(Note, "subjects", note.id, issues[0].id)
    return { project, issues, owner }
  }
)
export type ProductDemoData = Effect.Success<ReturnType<typeof seedProductDemo>>
