import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

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
