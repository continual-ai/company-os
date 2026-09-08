import { createCapabilities } from "@company/runtime/client/capabilities"
import { createModelClient } from "@company/runtime/client/http-client"
import { createModelQueries } from "@company/runtime/client/model-query-client"
import { createAssetUploader } from "@company/runtime/ui/assets/upload"
import type { ModelUiRuntime } from "@company/runtime/ui/model/runtime-context"
import { Effect } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { HttpApiClient } from "effect/unstable/httpapi"

import { applicationHttpApi } from "#/examples/http-api.ts"
import { Model } from "#/examples/model.ts"
import { modelUi } from "#/examples/ui.ts"
import { modelMetadata } from "#/model-metadata.ts"
import { allowedCapabilitiesQuery } from "#/ui/application/load-capabilities.ts"
const client = createModelClient(
  Model,
  Effect.runSync(
    HttpApiClient.make(applicationHttpApi).pipe(
      Effect.provide(FetchHttpClient.layer)
    )
  )
)
const data = createModelQueries(Model, client)
export const presentation: ModelUiRuntime = {
  model: Model,
  data,
  ui: modelUi,
  defaultCurrency: modelMetadata.defaultCurrency,
  permissions: createCapabilities(Model),
  capabilities: allowedCapabilitiesQuery,
  uploadAsset: createAssetUploader(data.asset),
}
