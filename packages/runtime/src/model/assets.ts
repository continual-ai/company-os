import { Asset } from "#/model/asset.ts"
import { defineModule } from "#/model/index.ts"
export const AssetsModule = defineModule({
  id: "assets",
  name: "Assets",
  interfaces: [],
  links: [],
  objects: [Asset],
})
