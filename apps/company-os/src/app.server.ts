import { AccessServer } from "@company/runtime/server/access"
import { AssetsServer } from "@company/runtime/server/assets"

/** Server contributions for the definitions installed in app.model.ts. */
export const serverModules = [AccessServer, AssetsServer] as const
