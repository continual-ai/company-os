import { appMetadata } from "#/app.config.ts"
import { Model } from "#/app.model.ts"
import { modelUi } from "#/app.ui.ts"
import { data } from "#/app/app-client.ts"
import { createAssetUploader } from "#/runtime/assets/ui/upload.ts"
import type { ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"
export const presentation: ModelUiRuntime = {
  model: Model,
  data,
  ui: modelUi,
  defaultCurrency: appMetadata.defaultCurrency,
  uploadAsset: createAssetUploader(data.asset),
}
