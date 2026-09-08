import { Effect } from "effect"

import { AssetService } from "#/modules/assets/asset/server/asset-service.ts"
import { AssetsModule } from "#/modules/assets/model.ts"
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
