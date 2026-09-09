import { Effect } from "effect"

import { AssetsModule } from "#/runtime/assets/model/index.ts"
import { AssetService } from "#/runtime/assets/server/asset-service.ts"
import { defineModuleServer } from "#/runtime/server/model/module-server.ts"

export const AssetsServer = defineModuleServer(
  AssetsModule,
  Effect.gen(function* () {
    const assets = yield* AssetService
    return {
      asset: {
        beginUpload: assets.beginUpload,
        completeUpload: assets.completeUpload,
      },
    }
  }),
  AssetService.layer
)
