import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useMemo, useRef, type ReactNode } from "react"

import {
  activeModuleKey,
  activePresentation,
  moduleCatalogQuery,
} from "#/app/ui/application/active-presentation.ts"
import { ModelUiProvider } from "#/runtime/ui/model/runtime-context.tsx"

/** Rebuild the UI runtime only when activation changes, never on background query activity. */
export function ActiveModelProvider({ children }: { children: ReactNode }) {
  const { data: key = activeModuleKey(undefined) } = useQuery({
    ...moduleCatalogQuery,
    select: activeModuleKey,
    refetchInterval: 30_000,
  })
  const cache = useQueryClient()
  const runtime = useMemo(() => activePresentation(key), [key])
  const previous = useRef(runtime)
  useEffect(() => {
    if (previous.current === runtime) return
    const disabled = new Set(
      Object.keys(previous.current.model.objects).filter(
        (id) => !Object.hasOwn(runtime.model.objects, id)
      )
    )
    previous.current = runtime
    if (disabled.size)
      cache.removeQueries({
        predicate: (query) =>
          Array.isArray(query.meta?.objectTypes) &&
          query.meta.objectTypes.some((type: string) => disabled.has(type)),
      })
  }, [cache, runtime])
  return <ModelUiProvider value={runtime}>{children}</ModelUiProvider>
}
