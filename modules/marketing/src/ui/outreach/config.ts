import { defineCollectionView } from "@company/runtime/ui/module"
import type { ObjectUi } from "@company/runtime/ui/module"

import type { Outreach } from "#/model/outreach.ts"

export const outreachUi = {
  collection: {
    views: [
      defineCollectionView("all", "All outreach", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
      }),
      defineCollectionView("review", "Needs review", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["review"] } },
        ],
      }),
      defineCollectionView("queue", "Queue", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["queued"] } },
        ],
      }),
      defineCollectionView("replies", "Replies", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["replied"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Outreach>
