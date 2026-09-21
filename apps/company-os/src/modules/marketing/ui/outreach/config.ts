import { Model } from "#/app.model.ts"
import { Outreach } from "#/modules/marketing/model/outreach.ts"
import { defineCollectionView, type ObjectUi } from "#/runtime/ui/module.ts"

export const outreachUi = {
  collection: {
    views: [
      defineCollectionView(Model, Outreach, "all", "All outreach", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
      }),
      defineCollectionView(Model, Outreach, "review", "Needs review", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["review"] } },
        ],
      }),
      defineCollectionView(Model, Outreach, "queue", "Queue", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["queued"] } },
        ],
      }),
      defineCollectionView(Model, Outreach, "replies", "Replies", {
        columns: ["subject", "contact", "campaign", "status", "scheduledAt"],
        filters: [
          { id: "status", value: { operator: "equals", values: ["replied"] } },
        ],
      }),
    ],
  },
} satisfies ObjectUi<typeof Outreach>
