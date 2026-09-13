import { Effect } from "effect"

import { PullRequest, Repository } from "#/modules/engineering/model/index.ts"
import { Issue } from "#/modules/product/model/index.ts"
import type { ProductDemoData } from "#/modules/product/seeds/index.ts"
import { Database } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export { seedEngineeringPerformance } from "#/modules/engineering/seeds/performance.ts"

export const seedEngineeringDemo = Effect.fn("@company/seedEngineeringDemo")(
  function* ({ project, issues, owner }: ProductDemoData) {
    const records = yield* Database
    const services = {
      pullRequest: records.repository(PullRequest),
      repository: records.repository(Repository),
    }
    const repository = yield* services.repository.create({
      name: "Customer portal",
      links: { projects: [project.id], owner: owner },
    })
    for (const [index, issue] of issues.entries()) {
      const pr = yield* services.pullRequest.create({
        title: issue.title,
        number: 120 + index,
        status: index === 2 ? "merged" : "open",
        review: index === 0 ? "changesRequested" : "approved",
        checks: index === 0 ? "failing" : "passing",
        links: { repository: repository.id },
      })
      yield* linkSeedRecords(Issue, "pullRequests", issue.id, pr.id)
    }
  }
)
