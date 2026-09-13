import type { Project } from "#/modules/product/model/project.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

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
