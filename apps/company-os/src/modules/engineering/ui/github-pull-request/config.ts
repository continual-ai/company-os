import { Model } from "#/app.model.ts"
import { GitHubPullRequest } from "#/modules/engineering/model/github-pull-request.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const githubPullRequestUi = {
  collection: {
    views: [
      defineCollectionView(
        Model,
        GitHubPullRequest,
        "all",
        "All pull requests",
        {
          columns: ["title", "repository", "status", "review", "checks"],
        }
      ),
      defineCollectionView(Model, GitHubPullRequest, "open", "Open", {
        columns: ["title", "repository", "status", "review", "checks"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["open"] } },
        ],
      }),
      defineCollectionView(
        Model,
        GitHubPullRequest,
        "changes",
        "Needs changes",
        {
          columns: ["title", "repository", "status", "review", "checks"],
          filters: [
            {
              id: "review",
              value: { operator: "equals", values: ["changesRequested"] },
            },
          ],
        }
      ),
    ],
  },
} satisfies ObjectUi<typeof GitHubPullRequest>
