import type { Model } from "company-os/model"

import type { ObjectUi } from "@/ui/model/module-ui"
import { defineCollectionView } from "@/ui/model/object-collection-view"

export const contentUi = {
  collection: {
    views: [
      defineCollectionView("all", "All content", {
        columns: [
          "title",
          "format",
          "status",
          "campaign",
          "owner",
          "scheduledAt",
        ],
        sorting: [{ id: "title", desc: false }],
      }),
      defineCollectionView("review", "Needs review", {
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
      defineCollectionView("scheduled", "Scheduled", {
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
      defineCollectionView("calendar", "Publishing calendar", {
        layout: { type: "calendar", start: "scheduledAt" },
        columns: ["title", "status"],
      }),
      defineCollectionView("board", "Board", {
        layout: { type: "kanban", groupBy: "status" },
        columns: ["title", "format", "scheduledAt"],
      }),
    ],
  },
} satisfies ObjectUi<typeof Model.objects.content>
