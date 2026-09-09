import { Asset } from "#/runtime/assets/model/asset.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const AssetsModule = defineModule({
  description: "Store and share files used throughout the application.",
  id: "assets",
  name: "Assets",
  objects: [Asset],
})
