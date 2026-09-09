import { createCapabilities } from "#/runtime/client/capabilities.ts"
import { modelQuery } from "#/runtime/client/model-query-client.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import {
  composeModelUi,
  type defineModuleUi,
} from "#/runtime/ui/model/module-ui.tsx"
import type { ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Presentation runtime for rendering tests: no transport, no granted capabilities, no uploads. */
export function testPresentation(
  model: ModelCatalog,
  ...ui: ReadonlyArray<ReturnType<typeof defineModuleUi>>
): ModelUiRuntime {
  return {
    model,
    data: {},
    ui: composeModelUi(model, ...ui),
    defaultCurrency: "USD",
    permissions: createCapabilities(model),
    capabilities: (checks) =>
      modelQuery(["@iam"], "check", checks, async () => []),
    uploadAsset: () =>
      Promise.reject(new Error("Uploads are not available in tests.")),
  }
}
