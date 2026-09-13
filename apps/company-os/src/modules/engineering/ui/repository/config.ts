import type { Repository } from "#/modules/engineering/model/repository.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const repositoryUi = {
  collection: {
    views: [
      defineCollectionView("all", "All repositories", {
        columns: ["name", "projects", "url", "defaultBranch"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Repository>
