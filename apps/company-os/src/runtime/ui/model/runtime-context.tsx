import { createContext, useContext, type ReactNode } from "react"

import type { ModelCatalog } from "#/runtime/model/index.ts"
import type { ResolvedObjectUi } from "#/runtime/ui/model/module-ui.tsx"

/** Immutable application configuration. User state belongs to the request or QueryClient. */
export interface ModelUiRuntime {
  readonly model: ModelCatalog
  readonly data: object
  readonly ui: Readonly<Record<string, ResolvedObjectUi>>
  readonly defaultCurrency: string
  readonly uploadAsset: (
    file: File,
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
