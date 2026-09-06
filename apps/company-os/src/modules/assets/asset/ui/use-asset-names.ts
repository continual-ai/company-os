import { RecordId, type FileRef } from "@company/runtime"
import { Effect } from "effect"
import { useMemo } from "react"

import { client } from "@/app-client"
import { useModelQuery } from "@/use-model-query"

const assetId = RecordId("asset")
const noNames: ReadonlyMap<string, string> = new Map()

/** File controls observe shared asset metadata instead of retaining another copy. */
export function useAssetNames(references: ReadonlyArray<FileRef>) {
  const ids = JSON.stringify(references.map((reference) => reference.assetId))
  const query = useMemo(() => {
    const values: string[] = JSON.parse(ids)
    return values.length === 0
      ? Effect.succeed(noNames)
      : client.asset
          .batchGet({ ids: values.map(assetId) })
          .pipe(
            Effect.map(
              (batch) =>
                new Map(batch.items.map((asset) => [asset.id, asset.name]))
            )
          )
  }, [ids])
  return useModelQuery(query).value ?? noNames
}
