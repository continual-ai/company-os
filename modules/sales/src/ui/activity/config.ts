import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Activity } from "#/model/activity.ts"

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
} satisfies ObjectUi<typeof Activity>
