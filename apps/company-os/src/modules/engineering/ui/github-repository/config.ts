import type { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const githubRepositoryUi = {
  collection: {
    views: [
      defineCollectionView("all", "All repositories", {
        columns: [
          "fullName",
          "connection",
          "visibility",
          "projects",
          "defaultBranch",
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof GitHubRepository>
