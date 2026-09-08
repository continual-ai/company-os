import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Enrollment } from "#/model/enrollment.ts"

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
