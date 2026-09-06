import { defineCollectionView } from "@/ui/model/object-collection-view"

export const contactViews = [
  defineCollectionView("all", "All contacts", {
    columns: ["name", "jobTitle", "email", "phone"],
    sorting: [{ id: "name", desc: false }],
  }),
] as const
