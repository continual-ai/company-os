import type { Repository } from "#/modules/engineering/model/repository.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const repositoryUi = {
  collection: {
    views: [
      defineCollectionView("all", "All repositories", {
        columns: ["name", "project", "url", "defaultBranch"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Repository>
