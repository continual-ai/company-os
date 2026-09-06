import { defineCollectionView } from "@/ui/model/object-collection-view"

export const leadViews = [
  defineCollectionView("all", "All leads", {
    columns: ["name", "companyName", "email", "phone", "source", "status"],
    sorting: [{ id: "name", desc: false }],
  }),
  defineCollectionView("new", "New", {
    columns: ["name", "companyName", "email", "phone", "source", "status"],
    filters: [{ id: "status", value: { operator: "equals", values: ["new"] } }],
    sorting: [{ id: "name", desc: false }],
  }),
  defineCollectionView("qualified", "Qualified", {
    columns: ["name", "companyName", "email", "phone", "source", "status"],
    filters: [
      {
        id: "status",
        value: { operator: "equals", values: ["qualified"] },
      },
    ],
    sorting: [{ id: "name", desc: false }],
  }),
] as const
