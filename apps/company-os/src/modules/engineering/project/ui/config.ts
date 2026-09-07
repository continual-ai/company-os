import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

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
