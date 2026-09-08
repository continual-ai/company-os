import { defineCollectionView } from "@company/ui/model/collection-view"

export const noteViews = [
  defineCollectionView("all", "All notes", {
    columns: ["content"],
    layout: { type: "feed" },
  }),
  defineCollectionView("table", "Table", { columns: ["content"] }),
] as const
