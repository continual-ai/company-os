import type { Campaign } from "#/modules/marketing/model/campaign.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"
import type { ObjectUi } from "#/runtime/ui/module.ts"

export const campaignUi = {
  collection: {
    views: [
      defineCollectionView("all", "All campaigns", {
        columns: ["name", "channel", "status", "owner", "startDate"],
      }),
      defineCollectionView("active", "Active", {
        columns: ["name", "channel", "status", "owner", "startDate"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["active"] } },
        ],
      }),
      defineCollectionView("planning", "Planning", {
        columns: ["name", "channel", "status", "owner", "startDate"],
        filters: [
          {
            id: "status",
            value: { operator: "equals", values: ["draft", "planned"] },
          },
        ],
      }),
      defineCollectionView("board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["name", "channel", "owner", "startDate"],
      }),
      defineCollectionView("calendar", "Calendar", {
        layout: { type: "calendar", start: "startDate", end: "endDate" },
        columns: ["name", "channel", "owner"],
      }),
      defineCollectionView("timeline", "Timeline", {
        layout: { type: "gantt", start: "startDate", end: "endDate" },
        columns: ["name", "status", "owner"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Campaign>
