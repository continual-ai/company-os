import { useQueries } from "@tanstack/react-query"

import type { RecordRelationship } from "#/ui/model/record-relationships.ts"
import { useModelRuntime } from "#/ui/model/runtime-context.tsx"

/** Preview rows and counts share each relationship's authorized, invalidated query. */
export function useRecordRelationshipPreviews(
  relationships: ReadonlyArray<RecordRelationship>,
  enabled: boolean
) {
  const runtime = useModelRuntime()

  const results = useQueries({
    queries: relationships.map((relationship) => ({
      ...relationship.list({ pageSize: 3 }),
      enabled,
    })),
  })
  return relationships.map((relationship, index) => {
    const result = results[index]!
    return {
      key: relationship.key,
      label: relationship.label,
      total: result.data?.totalSize,
      pending: result.isPending,
      error: result.isError,
      retry: () => void result.refetch(),
      items: (result.data?.items ?? []).flatMap((record) => {
        const target =
          relationship.target ??
          Object.values(runtime.model.objects).find(
            (object) => object.id === record.objectType
          )
        return target ? [{ object: target, record }] : []
      }),
    }
  })
}
