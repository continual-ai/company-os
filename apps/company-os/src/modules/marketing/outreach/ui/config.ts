import { defineCollectionView } from "@company/ui/model/collection-view"
import type { ObjectUi } from "@company/ui/model/object-ui"

import type { Model } from "#/app.model.ts"

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
} satisfies ObjectUi<typeof Model.objects.outreach>
