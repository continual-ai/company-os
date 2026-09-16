import { Effect } from "effect"

import {
  GitHubConnection,
  GitHubIssue,
  GitHubPullRequest,
  GitHubRepository,
} from "#/modules/engineering/model/index.ts"
import type { ProductDemoData } from "#/modules/product/seeds/index.ts"
import { WebUrl } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/index.ts"

export { seedEngineeringPerformance } from "#/modules/engineering/seeds/performance.ts"

export const seedEngineeringDemo = Effect.fn("@company/seedEngineeringDemo")(
  function* ({ project, issues, owner }: ProductDemoData) {
    const records = yield* Database
    const connection = yield* records
      .repository(GitHubConnection)
      .create({ accountLogin: "demo-company" })
    const repository = yield* records.repository(GitHubRepository).create({
      nodeId: "demo-repository-portal",
      fullName: "demo-company/customer-portal",
      url: WebUrl("https://github.com/demo-company/customer-portal"),
      visibility: "private",
      defaultBranch: "main",
      links: {
        connection: connection.id,
        projects: [project.id],
        maintainer: owner,
      },
    })
    for (const [index, issue] of issues.entries()) {
      const githubIssue = yield* records.repository(GitHubIssue).create({
        nodeId: `demo-issue-${index}`,
        title: issue.title,
        number: 100 + index,
        url: WebUrl(
          `https://github.com/demo-company/customer-portal/issues/${100 + index}`
        ),
        state: index === 2 ? "closed" : "open",
        links: { repository: repository.id, productIssues: [issue.id] },
      })
      yield* records.repository(GitHubPullRequest).create({
        nodeId: `demo-pr-${index}`,
        title: issue.title,
        number: 120 + index,
        url: WebUrl(
          `https://github.com/demo-company/customer-portal/pull/${120 + index}`
        ),
        status: index === 2 ? "merged" : "open",
        review: index === 0 ? "changesRequested" : "approved",
        checks: index === 0 ? "failing" : "passing",
        links: {
          repository: repository.id,
          productIssues: [issue.id],
          githubIssues: [githubIssue.id],
        },
      })
    }
  }
)
