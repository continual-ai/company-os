import { createCapabilities } from "@company/runtime/client/capabilities"
import { createAssetUploader } from "@company/runtime/ui/assets/upload"
import type { ModelUiRuntime } from "@company/runtime/ui/model/runtime-context"

import { data } from "#/app-client.ts"
import { Model } from "#/app.model.ts"
import { modelUi } from "#/app.ui.ts"
import { modelMetadata } from "#/model-metadata.ts"
import { allowedCapabilitiesQuery } from "#/ui/application/load-capabilities.ts"
export const presentation: ModelUiRuntime = {
  model: Model,
  data,
  ui: modelUi,
  defaultCurrency: modelMetadata.defaultCurrency,
  permissions: createCapabilities(Model),
  capabilities: allowedCapabilitiesQuery,
  uploadAsset: createAssetUploader(data.asset),
}
