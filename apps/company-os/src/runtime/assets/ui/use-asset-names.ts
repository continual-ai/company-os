import { useQueries } from "@tanstack/react-query"

import { Asset } from "#/runtime/assets/model/asset.ts"
import { RecordId, type FileRef } from "#/runtime/model/index.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"
import { objectQueryClient } from "#/runtime/ui/model/use-object-client.ts"

const assetId = RecordId("asset")

/** Bounded metadata requests shared with every other asset consumer. */
export function useAssetNames(
  references: ReadonlyArray<FileRef>
): ReadonlyMap<string, string> {
  const runtime = useModelRuntime()
  const ids = [
    ...new Set(references.map((reference) => reference.assetId)),
  ].sort()
  const queries = []
  for (let index = 0; index < ids.length; index += 100)
    queries.push(
      objectQueryClient(runtime, Asset).list({
        filter: {
          field: "id",
          operator: "in",
          value: ids.slice(index, index + 100).map(assetId),
        },
        pageSize: 100,
      })
    )
  const results = useQueries({ queries })
  return new Map(
    results.flatMap((result) =>
      (result.data?.items ?? []).map((asset) => [asset.id, asset.name] as const)
    )
  )
}
