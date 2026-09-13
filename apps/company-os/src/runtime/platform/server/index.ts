import { Effect, Layer } from "effect"

import { ServiceAccountService } from "#/runtime/access/server/service-account-service.ts"
import { UserService } from "#/runtime/access/server/user-service.ts"
import { AssetService } from "#/runtime/assets/server/asset-service.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import {
  moduleCatalog,
  setModuleEnabled,
} from "#/runtime/platform/server/activation.ts"
import { defineModuleServer } from "#/runtime/server/module-server.ts"

export const PlatformServer = defineModuleServer(
  PlatformModule,
  {
    asset: {
      beginUpload: Effect.fn("asset.beginUpload")(function* (
        input: Parameters<typeof AssetService.Service.beginUpload>[0]
      ) {
        return yield* (yield* AssetService).beginUpload(input)
      }),
      completeUpload: Effect.fn("asset.completeUpload")(function* (
        input: Parameters<typeof AssetService.Service.completeUpload>[0]
      ) {
        return yield* (yield* AssetService).completeUpload(input)
      }),
    },
    moduleSetting: { catalog: moduleCatalog, setEnabled: setModuleEnabled },
  },
  Layer.mergeAll(
    ServiceAccountService.layer,
    UserService.layer,
    AssetService.layer
  )
)
export { activeModuleModel } from "#/runtime/platform/server/activation.ts"
export { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
