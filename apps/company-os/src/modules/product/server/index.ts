import { ProductModule } from "#/modules/product/model/index.ts"
import { issueGreeting } from "#/modules/product/server/issue-greeting.ts"
import { defineModuleServer } from "#/runtime/server/index.ts"

export const ProductServer = defineModuleServer(ProductModule, {
  controllers: [issueGreeting],
})
