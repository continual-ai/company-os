import type { Application } from "#/modules/hiring/model/application.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const applicationUi = {
  collection: {
    views: [
      defineCollectionView("all", "All applications", {
        columns: ["candidate", "job", "stage", "source", "rating"],
      }),
      defineCollectionView("pipeline", "Pipeline", {
        layout: { type: "kanban", groupBy: "stage" },
        columns: ["candidate", "job", "source", "rating"],
      }),
      defineCollectionView("active", "Active", {
        columns: ["candidate", "job", "stage", "source", "rating"],
        filters: [
          {
            id: "stage",
            value: {
              operator: "equals",
              values: ["new", "reviewing", "phoneScreen", "interview", "offer"],
            },
          },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Application>
