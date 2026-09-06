import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

export const campaignUi = {
  collection: {
    views: [
      defineCollectionView("all", "All campaigns", {
        columns: ["name", "channel", "status", "owner", "startDate"],
        sorting: [{ id: "name", desc: false }],
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
} satisfies ObjectUi<typeof Model.objects.campaign>
