import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Project } from "#/model/project.ts"

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
