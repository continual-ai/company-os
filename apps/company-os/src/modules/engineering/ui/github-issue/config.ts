import { Model } from "#/app.model.ts"
import { GitHubIssue } from "#/modules/engineering/model/github-issue.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const githubIssueUi = {
  collection: {
    views: [
      defineCollectionView(Model, GitHubIssue, "all", "All issues", {
        columns: ["title", "repository", "number", "state", "tasks"],
      }),
    ],
  },
} satisfies ObjectUi<typeof GitHubIssue>
