import { Model } from "#/app.model.ts"
import { Account } from "#/modules/crm/model/account.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"

export const accountViews = [
  defineCollectionView(Model, Account, "all", "All accounts", {
    columns: ["name", "domain", "industry", "fitScore", "lifecycleStage"],
  }),
  defineCollectionView(Model, Account, "prospects", "Prospects", {
    columns: ["name", "domain", "industry", "fitScore", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["prospect"] },
      },
    ],
  }),
  defineCollectionView(Model, Account, "customers", "Customers", {
    columns: [
      "name",
      "domain",
      "website",
      "industry",
      "fitScore",
      "lifecycleStage",
    ],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["customer"] },
      },
    ],
  }),
] as const
