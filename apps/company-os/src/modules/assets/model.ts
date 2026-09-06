import { defineModule } from "@company/runtime"

import { Asset } from "./asset/model"
export const AssetsModule = defineModule({
  id: "assets",
  name: "Assets",
  interfaces: [],
  links: [],
  objects: [Asset],
})
