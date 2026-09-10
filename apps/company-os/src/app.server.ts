import { SalesServer } from "#/modules/sales/server/index.ts"
import { SupportEngineeringServer } from "#/modules/support-engineering/server/index.ts"
import { PlatformServer } from "#/runtime/platform/server/index.ts"

/** Custom operation contributions for the modules composed in app.model.ts. */
export const serverModules = [
  PlatformServer,
  SalesServer,
  SupportEngineeringServer,
] as const
