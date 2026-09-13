import { defineCollectionView } from "#/runtime/ui/module.ts"

export const leadViews = [
  defineCollectionView("all", "All leads", {
    columns: ["name", "account", "contact", "opportunity", "source", "status"],
  }),
  defineCollectionView("new", "New", {
    columns: ["name", "account", "contact", "opportunity", "source", "status"],
    filters: [{ id: "status", value: { operator: "equals", values: ["new"] } }],
  }),
  defineCollectionView("qualified", "Qualified", {
    columns: ["name", "account", "contact", "opportunity", "source", "status"],
    filters: [
      {
        id: "status",
        value: { operator: "equals", values: ["qualified"] },
      },
    ],
  }),
] as const
