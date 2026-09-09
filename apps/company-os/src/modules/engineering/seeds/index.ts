import { Effect } from "effect"

import { Issue } from "#/modules/engineering/model/issue.ts"
import { Project } from "#/modules/engineering/model/project.ts"
import { PullRequest } from "#/modules/engineering/model/pull-request.ts"
import { Repository } from "#/modules/engineering/model/repository.ts"
import { Note } from "#/modules/notes/model/index.ts"
import type { RecordId } from "#/runtime/model/index.ts"
import { Records } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const seedEngineeringDemo = Effect.fn("@company/seedEngineeringDemo")(
  function* ({ owner }: { readonly owner: RecordId<"user"> }) {
    const records = yield* Records
    const services = {
      issue: records.writer(Issue),
      note: records.writer(Note),
      project: records.writer(Project),
      pullRequest: records.writer(PullRequest),
      repository: records.writer(Repository),
    }
    const project = yield* services.project.create({
      name: "Customer onboarding",
      objective: "Make account setup reliable for every new customer.",
      status: "active",
      owner,
    })
    const repository = yield* services.repository.create({
      name: "Customer portal",
      project: project.id,
      owner,
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
          project: project.id,
          assignee: owner,
          description:
            "Reported during Northstar's pilot. Keep the user in context and make the next step clear.",
        })
    )
    for (const [index, issue] of issues.entries()) {
      const pr = yield* services.pullRequest.create({
        title: issue.title,
        repository: repository.id,
        number: 120 + index,
        status: index === 2 ? "merged" : "open",
        review: index === 0 ? "changesRequested" : "approved",
        checks: index === 0 ? "failing" : "passing",
      })
      yield* linkSeedRecords(Issue, "pullRequests", issue.id, pr.id)
    }
    const note = yield* services.note.create({
      content:
        "### Recovery behavior\n\nKeep the original invitation context. Let the user request a fresh link without starting over.\n\n```text\nexpired → request new link → resume onboarding\n```",
    })
    yield* linkSeedRecords(Note, "subjects", note.id, issues[0].id)
    return { issue: issues[0].id }
  }
)
