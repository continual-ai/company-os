import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

export const enrollmentUi = {
  collection: {
    views: [
      defineCollectionView("all", "All enrollments", {
        columns: ["name", "contact", "campaign", "status", "nextTouchAt"],
      }),
      defineCollectionView("active", "Active", {
        columns: ["name", "contact", "campaign", "status", "nextTouchAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["active"] } },
        ],
      }),
      defineCollectionView("queued", "Queued", {
        columns: ["name", "contact", "campaign", "status", "nextTouchAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["queued"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.enrollment>
