import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

export const repositoryUi = {
  collection: {
    views: [
      defineCollectionView("all", "All repositories", {
        columns: ["name", "project", "url", "defaultBranch"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.repository>
