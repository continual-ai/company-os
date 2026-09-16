import { Effect } from "effect"

import {
  GitHubConnection,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
} from "#/modules/engineering/model/index.ts"
import type { ProductSeedData } from "#/modules/product/seeds/index.ts"
import { WebUrl } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

export const seedEngineeringPerformance = Effect.fn(
  "@company/seedEngineeringPerformance"
)(function* ({ projects, issues, owners }: ProductSeedData) {
  const records = yield* Database
  const connection = yield* records
    .repository(GitHubConnection)
    .create({ accountLogin: "demo-company" })
  const repositories = yield* Effect.forEach(
    ["Platform", "Customer portal"],
    (name, index) =>
      records.repository(GitHubRepository).create({
        nodeId: `performance-repository-${index}`,
        fullName: `demo-company/service-${index}`,
        description: name,
        visibility: "private",
        defaultBranch: "main",
        url: WebUrl(`https://github.com/demo-company/service-${index}`),
        links: {
          projects: projects.map(({ id }) => id),
          connection: connection.id,
          maintainer: owners[index % owners.length]!,
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
    const githubIssue = yield* records.repository(GitHubIssue).create({
      nodeId: `performance-issue-${index}`,
      title,
      number: 10000 + index,
      url: WebUrl(
        `https://github.com/demo-company/service-${index % repositories.length}/issues/${10000 + index}`
      ),
      state: status === "done" ? "closed" : "open",
      links: { repository: repository.id, productIssues: [issue.id] },
    })
    yield* records.repository(GitHubPullRequest).create({
      nodeId: `performance-pr-${index}`,
      title,
      number: 100 + index,
      url: WebUrl(
        `https://github.com/demo-company/service-${index % repositories.length}/pull/${100 + index}`
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
      links: {
        repository: repository.id,
        productIssues: [issue.id],
        githubIssues: [githubIssue.id],
      },
    })
  }
})
