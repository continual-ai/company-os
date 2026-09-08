import { createContext, useContext, type ReactNode } from "react"

import type { createCapabilities } from "#/client/capabilities.ts"
import type { CapabilityCheck } from "#/client/capabilities.ts"
import type { ModelQueryOptions } from "#/client/model-query-client.ts"
import type { ModelCatalog } from "#/model/index.ts"
import type { ResolvedObjectUi } from "#/ui/model/module-ui.tsx"

/** Immutable application configuration. User state belongs to the request or QueryClient. */
export interface ModelUiRuntime {
  readonly model: ModelCatalog
  readonly data: object
  readonly ui: Readonly<Record<string, ResolvedObjectUi>>
  readonly defaultCurrency: string
  readonly permissions: ReturnType<typeof createCapabilities>
  readonly capabilities: (
    checks: ReadonlyArray<CapabilityCheck>
  ) => ModelQueryOptions<ReadonlyArray<string>>
  readonly uploadAsset: (
    file: File,
    scope: string,
    signal: AbortSignal,
    progress: (value: number) => void
  ) => Promise<{ assetId: string }>
}
const RuntimeContext = createContext<ModelUiRuntime | null>(null)
export function ModelUiProvider({
  value,
  children,
}: {
  readonly value: ModelUiRuntime
  readonly children: ReactNode
}) {
  return <RuntimeContext value={value}>{children}</RuntimeContext>
}
export function useModelRuntime() {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new Error("Model UI requires ModelUiProvider.")
  return runtime
}
