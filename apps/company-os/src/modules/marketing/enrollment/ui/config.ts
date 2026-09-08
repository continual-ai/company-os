import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

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
