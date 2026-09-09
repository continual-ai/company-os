import { PlatformModule } from "#/modules/platform/model/index.ts"
import {
  moduleCatalog,
  setModuleEnabled,
} from "#/modules/platform/server/activation.ts"
import { defineModuleServer } from "#/runtime/server/model/module-server.ts"

export const PlatformServer = defineModuleServer(PlatformModule, {
  moduleSetting: { catalog: moduleCatalog, setEnabled: setModuleEnabled },
})
export {
  activeModuleModel,
  requireModuleOperation,
  readModuleCatalog,
} from "#/modules/platform/server/activation.ts"
export { seedModuleSettings } from "#/modules/platform/server/seed.ts"
