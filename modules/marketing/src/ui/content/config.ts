import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Content } from "#/model/content.ts"

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
} satisfies ObjectUi<typeof Content>
