import { PlatformServer } from "#/modules/platform/server/index.ts"
import { SalesServer } from "#/modules/sales/server/index.ts"
import { SupportEngineeringServer } from "#/modules/support-engineering/server/index.ts"
import { AccessServer } from "#/runtime/access/server/index.ts"
import { AssetsServer } from "#/runtime/assets/server/index.ts"

/** Custom operation contributions for the modules composed in app.model.ts. */
export const serverModules = [
  PlatformServer,
  AccessServer,
  AssetsServer,
  SalesServer,
  SupportEngineeringServer,
] as const
