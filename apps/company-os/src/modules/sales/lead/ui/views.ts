import { defineCollectionView } from "@/ui/model/object-collection-view"

export const leadViews = [
  defineCollectionView("all", "All leads", {
    columns: [
      "name",
      "company",
      "companyName",
      "email",
      "phone",
      "source",
      "status",
    ],
  }),
  defineCollectionView("new", "New", {
    columns: [
      "name",
      "company",
      "companyName",
      "email",
      "phone",
      "source",
      "status",
    ],
    filters: [{ id: "status", value: { operator: "equals", values: ["new"] } }],
  }),
  defineCollectionView("qualified", "Qualified", {
    columns: [
      "name",
      "company",
      "companyName",
      "email",
      "phone",
      "source",
      "status",
    ],
    filters: [
      {
        id: "status",
        value: { operator: "equals", values: ["qualified"] },
      },
    ],
  }),
] as const
