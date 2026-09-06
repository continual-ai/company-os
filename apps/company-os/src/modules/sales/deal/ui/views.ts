import { defineCollectionView } from "@/ui/model/object-collection-view"

export const dealViews = [
  defineCollectionView("all", "All deals", {
    columns: ["name", "parent", "stage", "amount", "expectedCloseDate"],
    sorting: [{ id: "expectedCloseDate", desc: false }],
  }),
  defineCollectionView("open", "Open deals", {
    columns: ["name", "parent", "stage", "amount", "expectedCloseDate"],
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
] as const
