import { defineCollectionView } from "#/runtime/ui/module.ts"

export const companyViews = [
  defineCollectionView("all", "All companies", {
    columns: ["name", "domain", "industry", "fitScore", "lifecycleStage"],
  }),
  defineCollectionView("prospects", "Prospects", {
    columns: ["name", "domain", "industry", "fitScore", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["prospect"] },
      },
    ],
  }),
  defineCollectionView("customers", "Customers", {
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
