import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

export const projectUi = {
  collection: {
    views: [
      defineCollectionView("all", "All projects", {
        columns: ["name", "status", "owner", "targetDate"],
      }),
      defineCollectionView("active", "Active", {
        columns: ["name", "status", "owner", "targetDate"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["active"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.project>
