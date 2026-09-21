import { Effect } from "effect"

import { type BaseRecord } from "#/runtime/model/definition/object.ts"
import {
  modelObjectLinkTraversals,
  RecordId,
  type Expansion,
  type ModelCatalog,
} from "#/runtime/model/index.ts"
import { linkPreview } from "#/runtime/model/record-links.ts"
import { InvalidExpansion } from "#/runtime/server/errors.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

/** Shared canonical loader for batchGet and expansion: deduplicate once, then batch by concrete type. */
export const makeRecordHydration = Effect.gen(function* () {
  const { model, storage } = yield* ModelContext
  const { sql } = yield* SqlDatabase
  const repositories = yield* RecordStore
  const objects = storage.core.objects
  const load = Effect.fn("@company/Records.load")(function* (
    identifiers: ReadonlyArray<string>,
    activeModel: ModelCatalog = model
  ) {
    const ids = [...new Set(identifiers)]
    if (ids.length === 0) return []
    const selection = {
      id: objects.columns.id,
      objectType: objects.columns.objectType,
    }
    const refs = yield* sql<
      SelectionRow<typeof selection>
    >`select ${projection(selection)} from ${objects} where ${inValues(sql, objects.columns.id, ids)}`
    const batches = yield* Effect.forEach(
      Object.values(activeModel.objects).filter((object) =>
        refs.some((ref) => ref.objectType === object.id)
      ),
      (object) =>
        repositories
          .get(object)
          .batchGet(
            refs
              .filter((ref) => ref.objectType === object.id)
              .map((ref) => RecordId(object.id)(ref.id))
          )
    )
    const byId = new Map(
      batches.flat().map((record) => [String(record.id), record])
    )
    return ids.flatMap((id) => {
      const record = byId.get(id)
      return record ? [record] : []
    })
  })
  const expand = Effect.fn("@company/Records.expand")(function* <
    R extends BaseRecord,
  >(
    records: ReadonlyArray<R>,
    expansion?: Expansion,
    activeModel: ModelCatalog = model
  ) {
    if (!expansion) return records
    const keys = expansion === true ? undefined : Object.keys(expansion)
    const ids = new Set<string>()
    for (const record of records) {
      const object = activeModel.objects[record.objectType]!
      const known = new Set(
        modelObjectLinkTraversals(activeModel, object).map(
          ({ traversal }) => traversal.key
        )
      )
      const unknown = keys?.find((key) => !known.has(key))
      if (unknown)
        return yield* Effect.fail(
          new InvalidExpansion({
            message: `Unknown link '${object.id}.${unknown}'.`,
            path: ["expand", unknown],
          })
        )
      for (const key of keys ?? known)
        for (const id of linkPreview(record.links[key]).ids) ids.add(id)
    }
    if (ids.size > 1000)
      return yield* Effect.fail(
        new InvalidExpansion({
          message:
            "Expansion exceeds 1000 distinct target records. Select fewer links or a smaller page.",
          path: ["expand"],
        })
      )
    const targets = yield* load([...ids], activeModel)
    const byId = new Map(targets.map((record) => [String(record.id), record]))
    const missing = [...ids].find((id) => !byId.has(id))
    if (missing)
      return yield* Effect.fail(
        new InvalidExpansion({
          message: `Expansion target '${missing}' is unavailable.`,
          path: ["expand"],
        })
      )
    return records.map((record) => ({
      ...record,
      links: Object.fromEntries(
        Object.entries(record.links).map(([key, value]) => {
          if (keys && !keys.includes(key)) return [key, value]
          if (value === null) return [key, null]
          if (typeof value === "string") return [key, byId.get(value)!]
          const preview = linkPreview(value)
          return [
            key,
            {
              items: preview.ids.map((id) => byId.get(id)!),
              totalSize: preview.totalSize,
              totalSizeExact: preview.totalSizeExact,
            },
          ]
        })
      ),
    }))
  })
  return { load, expand }
})
