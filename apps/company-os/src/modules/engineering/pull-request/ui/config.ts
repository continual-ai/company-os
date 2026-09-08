import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

export const pullRequestUi = {
  collection: {
    views: [
      defineCollectionView("all", "All pull requests", {
        columns: ["title", "repository", "status", "review", "checks"],
      }),
      defineCollectionView("open", "Open", {
        columns: ["title", "repository", "status", "review", "checks"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["open"] } },
        ],
      }),
      defineCollectionView("changes", "Needs changes", {
        columns: ["title", "repository", "status", "review", "checks"],
        filters: [
          {
            id: "review",
            value: { operator: "equals", values: ["changesRequested"] },
          },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.pullRequest>
