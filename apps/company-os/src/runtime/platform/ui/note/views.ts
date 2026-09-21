import { PlatformModel } from "#/runtime/platform/model/index.ts"
import { defineCollectionView } from "#/runtime/ui/module.ts"

export const noteViews = [
  defineCollectionView(
    PlatformModel,
    PlatformModel.objects.note,
    "all",
    "All notes",
    {
      columns: ["content"],
      layout: { type: "feed" },
    }
  ),
  defineCollectionView(
    PlatformModel,
    PlatformModel.objects.note,
    "table",
    "Table",
    { columns: ["content"] }
  ),
] as const
