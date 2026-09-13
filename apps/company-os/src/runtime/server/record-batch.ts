import { Effect, Schema } from "effect"

import {
  recordBatchInput,
  type RecordBatchInput,
} from "#/runtime/contract/record-batch.ts"
import { RecordId, type ModelCatalog } from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { makeRecordHydration } from "#/runtime/server/storage/hydration.ts"
/** One ID lookup, then one query per concrete type. Missing and inactive IDs have identical results. */
export function createRecordBatchGet(model: ModelCatalog) {
  return Effect.fn("@company/records.batchGet")(function* (
    input: RecordBatchInput
  ) {
    yield* requireProjectAccess
    const request = yield* Schema.decodeUnknownEffect(recordBatchInput)(input)
    const ids = [...new Set(request.ids)]
    if (ids.length === 0) return { items: [], missingIds: [] }
    const hydration = yield* makeRecordHydration
    const records = yield* hydration.load(ids, model)
    const expanded = yield* hydration.expand(records, request.expand, model)
    const byId = new Map(expanded.map((record) => [record.id, record]))
    return {
      items: ids.flatMap((id) => {
        const record = byId.get(RecordId("object")(id))
        return record ? [record] : []
      }),
      missingIds: ids.filter((id) => !byId.has(RecordId("object")(id))),
    }
  })
}
