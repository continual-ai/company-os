import { Effect } from "effect"

import { AssetsModule } from "#/model/assets.ts"
import { AssetService } from "#/server/assets/asset-service.ts"
import { defineModuleServer } from "#/server/model/module-server.ts"

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
