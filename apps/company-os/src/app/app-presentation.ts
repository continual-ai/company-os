import { EnabledModel } from "#/app.model.ts"
import { modelUi } from "#/app.ui.ts"
import { data } from "#/app/app-client.ts"
import { allowedCapabilitiesQuery } from "#/app/ui/application/load-capabilities.ts"
import { modelMetadata } from "#/model-metadata.ts"
import { createAssetUploader } from "#/runtime/assets/ui/upload.ts"
import { createCapabilities } from "#/runtime/client/capabilities.ts"
import type { ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"
export const presentation: ModelUiRuntime = {
  model: EnabledModel,
  data,
  ui: modelUi,
  defaultCurrency: modelMetadata.defaultCurrency,
  permissions: createCapabilities(EnabledModel),
  capabilities: allowedCapabilitiesQuery,
  uploadAsset: createAssetUploader(data.asset),
}
