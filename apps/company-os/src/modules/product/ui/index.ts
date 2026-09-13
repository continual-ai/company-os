import { ProductModule } from "#/modules/product/model/index.ts"
import { issueUi } from "#/modules/product/ui/issue/config.ts"
import { projectUi } from "#/modules/product/ui/project/config.ts"
import { defineModuleUi } from "#/runtime/ui/module.ts"

export const ProductUi = defineModuleUi(ProductModule, {
  project: projectUi,
  issue: issueUi,
})
