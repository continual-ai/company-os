import { defineCollectionView } from "@/ui/model/object-collection-view"

export const companyViews = [
  defineCollectionView("all", "All companies", {
    columns: ["name", "domain", "industry", "lifecycleStage"],
    sorting: [{ id: "name", desc: false }],
  }),
  defineCollectionView("prospects", "Prospects", {
    columns: ["name", "domain", "industry", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["prospect"] },
      },
    ],
    sorting: [{ id: "name", desc: false }],
  }),
  defineCollectionView("customers", "Customers", {
    columns: ["name", "domain", "website", "industry", "lifecycleStage"],
    filters: [
      {
        id: "lifecycleStage",
        value: { operator: "equals", values: ["customer"] },
      },
    ],
    sorting: [{ id: "name", desc: false }],
  }),
] as const
