import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

export const activityUi = {
  collection: {
    views: [
      defineCollectionView("all", "All activities", {
        columns: ["title", "kind", "status", "owner", "dueAt"],
      }),
      defineCollectionView("planned", "Planned", {
        columns: ["title", "kind", "status", "owner", "dueAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["planned"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.activity>
