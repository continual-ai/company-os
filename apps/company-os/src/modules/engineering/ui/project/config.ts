import type { Project } from "#/modules/engineering/model/project.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

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
} satisfies ObjectUi<typeof Project>
