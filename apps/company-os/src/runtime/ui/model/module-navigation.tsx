import { useMemo } from "react"

import { createModelNavigation } from "#/runtime/ui/model/model-navigation.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Module destinations, computed once per runtime. */
export function useModelNavigation() {
  const runtime = useModelRuntime()
  return useMemo(() => {
    const modules = createModelNavigation(runtime)
    return { modules }
  }, [runtime])
}
