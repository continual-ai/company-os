import { defineCollectionView } from "#/runtime/ui/module.ts"

export const noteViews = [
  defineCollectionView("all", "All notes", {
    columns: ["content"],
    layout: { type: "feed" },
  }),
  defineCollectionView("table", "Table", { columns: ["content"] }),
] as const
