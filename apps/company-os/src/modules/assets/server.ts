import { Effect } from "effect"

import { defineModuleServer } from "@/server/model/module-server"

import { AssetService } from "./asset/server/asset-service"
import { AssetsModule } from "./model"

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
