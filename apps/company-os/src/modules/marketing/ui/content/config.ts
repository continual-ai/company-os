import { Model } from "#/app.model.ts"
import { Content } from "#/modules/marketing/model/content.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const contentUi = {
  collection: {
    views: [
      defineCollectionView(Model, Content, "all", "All content", {
        columns: [
          "title",
          "format",
          "status",
          "campaign",
          "owner",
          "scheduledAt",
        ],
      }),
      defineCollectionView(Model, Content, "review", "Needs review", {
        columns: [
          "title",
          "format",
          "status",
          "campaign",
          "owner",
          "scheduledAt",
        ],
        filters: [
          { id: "status", value: { operator: "equals", values: ["review"] } },
        ],
      }),
      defineCollectionView(Model, Content, "scheduled", "Scheduled", {
        columns: [
          "title",
          "format",
          "status",
          "campaign",
          "owner",
          "scheduledAt",
        ],
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["scheduled"] },
          },
        ],
      }),
      defineCollectionView(Model, Content, "calendar", "Publishing calendar", {
        layout: { type: "calendar", start: "scheduledAt" },
        columns: ["title", "status"],
      }),
      defineCollectionView(Model, Content, "board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["title", "format", "scheduledAt"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Content>
