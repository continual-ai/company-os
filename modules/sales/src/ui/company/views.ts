import { defineCollectionView } from "@company/runtime/ui/module"

export const companyViews = [
  defineCollectionView("all", "All companies", {
    columns: ["name", "domain", "industry", "lifecycleStage"],
  }),
  defineCollectionView("prospects", "Prospects", {
    columns: ["name", "domain", "industry", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["prospect"] },
      },
    ],
  }),
  defineCollectionView("customers", "Customers", {
    columns: ["name", "domain", "website", "industry", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["customer"] },
      },
    ],
  }),
] as const
