import type { Enrollment } from "#/modules/marketing/model/enrollment.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

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
} satisfies ObjectUi<typeof Enrollment>
