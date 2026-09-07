import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

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
