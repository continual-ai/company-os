import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Repository } from "#/model/repository.ts"

export const repositoryUi = {
  collection: {
    views: [
      defineCollectionView("all", "All repositories", {
        columns: ["name", "project", "url", "defaultBranch"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Repository>
