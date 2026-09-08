import { defineModule } from "@company/runtime"

import { Asset } from "#/modules/assets/asset/model.ts"
export const AssetsModule = defineModule({
  id: "assets",
  name: "Assets",
  interfaces: [],
  links: [],
  objects: [Asset],
})
