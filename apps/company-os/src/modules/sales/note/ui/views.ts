import { defineCollectionView } from "@/ui/model/object-collection-view"

export const noteViews = [
  defineCollectionView("all", "All notes", {
    columns: ["content"],
  }),
] as const
