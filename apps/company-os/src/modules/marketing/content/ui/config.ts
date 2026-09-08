import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

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
