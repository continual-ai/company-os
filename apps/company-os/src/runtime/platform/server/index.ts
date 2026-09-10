import { Effect, Layer } from "effect"

import { ServiceAccountService } from "#/runtime/access/server/service-account-service.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import { AssetService } from "#/runtime/assets/server/asset-service.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import {
  moduleCatalog,
  setModuleEnabled,
} from "#/runtime/platform/server/activation.ts"
import { defineModuleServer } from "#/runtime/server/model/module-server.ts"

export const PlatformServer = defineModuleServer(
  PlatformModule,
  Effect.gen(function* () {
    const assets = yield* AssetService
    return {
      asset: {
        beginUpload: assets.beginUpload,
        completeUpload: assets.completeUpload,
      },
      moduleSetting: { catalog: moduleCatalog, setEnabled: setModuleEnabled },
    }
  }),
  Layer.mergeAll(
    ServiceAccountService.layer,
    UserService.layer,
    AssetService.layer
  )
)
export {
  activeModuleModel,
  requireModuleOperation,
} from "#/runtime/platform/server/activation.ts"
export { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
