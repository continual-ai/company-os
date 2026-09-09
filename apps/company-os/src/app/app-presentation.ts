import { appMetadata } from "#/app.config.ts"
import { Model } from "#/app.model.ts"
import { modelUi } from "#/app.ui.ts"
import { data } from "#/app/app-client.ts"
import { allowedCapabilitiesQuery } from "#/app/ui/application/load-capabilities.ts"
import { createAssetUploader } from "#/runtime/assets/ui/upload.ts"
import { createCapabilities } from "#/runtime/contract/capabilities.ts"
import type { ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"
export const presentation: ModelUiRuntime = {
  model: Model,
  data,
  ui: modelUi,
  defaultCurrency: appMetadata.defaultCurrency,
  permissions: createCapabilities(Model),
  capabilities: allowedCapabilitiesQuery,
  uploadAsset: createAssetUploader(data.asset),
}
