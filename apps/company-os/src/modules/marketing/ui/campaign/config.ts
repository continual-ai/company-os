import { Model } from "#/app.model.ts"
import { Campaign } from "#/modules/marketing/model/campaign.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const campaignUi = {
  collection: {
    views: [
      defineCollectionView(Model, Campaign, "all", "All campaigns", {
        columns: ["name", "channel", "status", "owner", "startDate"],
      }),
      defineCollectionView(Model, Campaign, "active", "Active", {
        columns: ["name", "channel", "status", "owner", "startDate"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["active"] } },
        ],
      }),
      defineCollectionView(Model, Campaign, "planning", "Planning", {
        columns: ["name", "channel", "status", "owner", "startDate"],
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["draft", "planned"] },
          },
        ],
      }),
      defineCollectionView(Model, Campaign, "board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["name", "channel", "owner", "startDate"],
      }),
      defineCollectionView(Model, Campaign, "calendar", "Calendar", {
        layout: { type: "calendar", start: "startDate", end: "endDate" },
        columns: ["name", "channel", "owner"],
      }),
      defineCollectionView(Model, Campaign, "timeline", "Timeline", {
        layout: { type: "gantt", start: "startDate", end: "endDate" },
        columns: ["name", "status", "owner"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Campaign>
