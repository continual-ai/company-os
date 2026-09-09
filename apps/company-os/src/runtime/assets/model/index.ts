import { Asset } from "#/runtime/assets/model/asset.ts"
import { defineModule } from "#/runtime/model/index.ts"
export const AssetsModule = defineModule({
  id: "assets",
  name: "Assets",
  objects: [Asset],
})
