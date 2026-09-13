import { DateTime, Effect } from "effect"

import { PullRequest, Repository } from "#/modules/engineering/model/index.ts"
import { Issue } from "#/modules/product/model/index.ts"
import type { ProductSeedData } from "#/modules/product/seeds/index.ts"
import { Timestamp, WebUrl } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"
import { linkSeedRecords } from "#/runtime/server/seeds.ts"

export const seedEngineeringPerformance = Effect.fn(
  "@company/seedEngineeringPerformance"
)(function* ({ projects, issues, owners }: ProductSeedData) {
  const now = yield* DateTime.now
  const records = yield* Database
  const repositories = yield* Effect.forEach(
    ["Platform", "Customer portal"],
    (name, index) =>
      records.repository(Repository).create({
        name,
        url: WebUrl(`https://code.example.test/engineering/service-${index}`),
        links: {
          projects: projects.map(({ id }) => id),
          owner: owners[index % owners.length]!,
        },
      })
  )
  for (const [index, issue] of issues.entries()) {
    const { title, status } = issue
    const repository = repositories[index % repositories.length]!
    const prStatus =
      status === "done"
        ? "merged"
        : (["draft", "open", "open", "closed"] as const)[index % 4]!
    const pr = yield* records.repository(PullRequest).create({
      title,
      number: 100 + index,
      url: WebUrl(
        `https://code.example.test/engineering/service-${index % repositories.length}/pull/${100 + index}`
      ),
      status: prStatus,
      review:
        prStatus === "merged"
          ? "approved"
          : (["pending", "changesRequested", "approved"] as const)[index % 3]!,
      checks:
        prStatus === "merged"
          ? "passing"
          : (["pending", "passing", "failing"] as const)[
              Math.floor(index / 2) % 3
            ]!,
      observedAt: Timestamp(
        DateTime.formatIso(DateTime.subtract(now, { hours: index % 48 }))
      ),
      links: { repository: repository.id },
    })
    yield* linkSeedRecords(Issue, "pullRequests", issue.id, pr.id)
  }
})
