import { defineCollectionView } from "@company/runtime/ui/module"

export const noteViews = [
  defineCollectionView("all", "All notes", {
    columns: ["content"],
    layout: { type: "feed" },
  }),
  defineCollectionView("table", "Table", { columns: ["content"] }),
] as const
