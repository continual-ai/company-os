import { Model } from "#/app.model.ts"
import { Lead } from "#/modules/sales/model/lead.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"

export const leadViews = [
  defineCollectionView(Model, Lead, "all", "All leads", {
    columns: ["name", "account", "contact", "opportunity", "source", "status"],
  }),
  defineCollectionView(Model, Lead, "new", "New", {
    columns: ["name", "account", "contact", "opportunity", "source", "status"],
    filters: [{ id: "status", value: { operator: "equals", values: ["new"] } }],
  }),
  defineCollectionView(Model, Lead, "qualified", "Qualified", {
    columns: ["name", "account", "contact", "opportunity", "source", "status"],
    filters: [
      {
        id: "status",
        value: { operator: "equals", values: ["qualified"] },
      },
    ],
  }),
] as const
