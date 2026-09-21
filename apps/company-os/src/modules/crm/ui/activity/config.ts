import { Model } from "#/app.model.ts"
import { Activity } from "#/modules/crm/model/activity.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const activityUi = {
  collection: {
    views: [
      defineCollectionView(Model, Activity, "all", "All activities", {
        columns: ["title", "kind", "status", "owner", "dueAt"],
      }),
      defineCollectionView(Model, Activity, "planned", "Planned", {
        columns: ["title", "kind", "status", "owner", "dueAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["planned"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Activity>
