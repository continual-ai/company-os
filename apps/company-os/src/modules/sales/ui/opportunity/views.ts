import { Model } from "#/app.model.ts"
import { Opportunity } from "#/modules/sales/model/opportunity.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"

export const opportunityViews = [
  defineCollectionView(Model, Opportunity, "all", "All opportunities", {
    columns: [
      "name",
      "accounts",
      "contacts",
      "stage",
      "healthScore",
      "amount",
      "expectedCloseDate",
    ],
    sorting: [{ id: "expectedCloseDate", desc: false }],
  }),
  defineCollectionView(Model, Opportunity, "open", "Open opportunities", {
    columns: [
      "name",
      "accounts",
      "contacts",
      "stage",
      "healthScore",
      "amount",
      "expectedCloseDate",
    ],
    filters: [
      {
        id: "stage",
        value: {
          operator: "equals",
          values: ["discovery", "qualified", "proposal", "negotiation"],
        },
      },
    ],
    sorting: [{ id: "expectedCloseDate", desc: false }],
  }),
  defineCollectionView(Model, Opportunity, "won", "Won", {
    columns: [
      "name",
      "accounts",
      "contacts",
      "amount",
      "expectedCloseDate",
      "stage",
    ],
    filters: [{ id: "stage", value: { operator: "equals", values: ["won"] } }],
    sorting: [{ id: "expectedCloseDate", desc: true }],
  }),
  defineCollectionView(Model, Opportunity, "pipeline", "Pipeline", {
    layout: { type: "kanban", groupBy: "stage" },
    columns: ["name", "amount", "healthScore", "expectedCloseDate"],
  }),
  defineCollectionView(
    Model,
    Opportunity,
    "closing-calendar",
    "Closing calendar",
    {
      layout: { type: "calendar", start: "expectedCloseDate" },
      columns: ["name", "stage", "amount"],
    }
  ),
] as const
