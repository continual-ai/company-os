import { Model } from "#/app.model.ts"
import { GitHubRepository } from "#/modules/engineering/model/github-repository.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const githubRepositoryUi = {
  collection: {
    views: [
      defineCollectionView(Model, GitHubRepository, "all", "All repositories", {
        columns: [
          "fullName",
          "connection",
          "syncedAt",
          "syncError",
          "visibility",
          "projects",
          "defaultBranch",
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof GitHubRepository>
