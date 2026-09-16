import type { GitHubIssue } from "#/modules/engineering/model/github-issue.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const githubIssueUi = {
  collection: {
    views: [
      defineCollectionView("all", "All issues", {
        columns: ["title", "repository", "number", "state", "productIssues"],
      }),
    ],
  },
} satisfies ObjectUi<typeof GitHubIssue>
