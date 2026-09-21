import { Model } from "#/app.model.ts"
import { Project } from "#/modules/work/model/project.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const projectUi = {
  collection: {
    views: [
      defineCollectionView(Model, Project, "all", "All projects", {
        columns: ["name", "status", "owner", "targetDate"],
      }),
      defineCollectionView(Model, Project, "active", "Active", {
        columns: ["name", "status", "owner", "targetDate"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["active"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Project>
