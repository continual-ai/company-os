import { Model } from "#/app.model.ts"
import { Application } from "#/modules/hiring/model/application.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const applicationUi = {
  collection: {
    views: [
      defineCollectionView(Model, Application, "all", "All applications", {
        columns: ["candidate", "job", "stage", "source", "rating"],
      }),
      defineCollectionView(Model, Application, "pipeline", "Pipeline", {
        layout: { type: "kanban", groupBy: "stage" },
        columns: ["candidate", "job", "source", "rating"],
      }),
      defineCollectionView(Model, Application, "active", "Active", {
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
