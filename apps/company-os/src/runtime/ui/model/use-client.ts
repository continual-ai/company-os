import { modelQueriesFor } from "#/runtime/client/model-query-client.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Read the provided, fully typed client. The model and client are constructed once outside React. */
export function useClient<M extends ModelCatalog>(model: M) {
  return modelQueriesFor(useModelRuntime().data, model)
}
