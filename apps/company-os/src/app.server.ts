import { CrmServer } from "#/modules/crm/server/index.ts"
import { EngineeringServer } from "#/modules/engineering/server/index.ts"
import { ProductServer } from "#/modules/product/server/index.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { PlatformServer } from "#/runtime/platform/server/index.ts"

/** Server contributions for the modules composed in app.model.ts. */
export const serverModules = [
  PlatformServer,
  CrmServer,
  SalesServer,
  ProductServer,
  EngineeringServer,
] as const
