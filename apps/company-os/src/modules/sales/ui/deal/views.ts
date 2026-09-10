import { defineCollectionView } from "#/runtime/ui/module.ts"

export const dealViews = [
  defineCollectionView("all", "All deals", {
    columns: [
      "name",
      "parent",
      "stage",
      "healthScore",
      "amount",
      "expectedCloseDate",
    ],
    sorting: [{ id: "expectedCloseDate", desc: false }],
  }),
  defineCollectionView("open", "Open deals", {
    columns: [
      "name",
      "parent",
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
  defineCollectionView("won", "Won", {
    columns: ["name", "parent", "amount", "expectedCloseDate", "stage"],
    filters: [{ id: "stage", value: { operator: "equals", values: ["won"] } }],
    sorting: [{ id: "expectedCloseDate", desc: true }],
  }),
  defineCollectionView("pipeline", "Pipeline", {
    layout: { type: "kanban", groupBy: "stage" },
    columns: ["name", "amount", "healthScore", "expectedCloseDate"],
  }),
  defineCollectionView("closing-calendar", "Closing calendar", {
    layout: { type: "calendar", start: "expectedCloseDate" },
    columns: ["name", "stage", "amount"],
  }),
] as const
