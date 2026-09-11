import { Effect, Schema } from "effect"

import {
  recordBatchInput,
  type RecordBatchInput,
} from "#/runtime/contract/record-batch.ts"
import { RecordId, type ModelCatalog } from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { ObjectRepositories } from "#/runtime/server/model/object-repositories.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"

/** One ID lookup, then one query per concrete type. Missing and inactive IDs have identical results. */
export function createRecordBatchGet(model: ModelCatalog) {
  return Effect.fn("@company/records.batchGet")(function* (
    input: RecordBatchInput
  ) {
    yield* requireProjectAccess
    const request = yield* Schema.decodeUnknownEffect(recordBatchInput)(input)
    const ids = [...new Set(request.ids)]
    if (ids.length === 0) return { items: [], missingIds: [] }
    const database = yield* Database
    const sql = database.sql
    const objects = (yield* ModelContext).storage.core.objects
    const repositories = yield* ObjectRepositories
    const fields = {
      id: objects.columns.id,
      objectType: objects.columns.objectType,
    }
    const refs = yield* sql<
      SelectionRow<typeof fields>
    >`select ${projection(fields)} from ${objects} where ${inValues(sql, objects.columns.id, ids)}`
    const batches = yield* Effect.forEach(
      Object.values(model.objects).filter((object) =>
        refs.some((ref) => ref.objectType === object.id)
      ),
      (object) =>
        repositories
          .get(object)
          .list({
            pageSize: ids.length,
            filter: {
              field: "id",
              operator: "in",
              value: refs
                .filter((ref) => ref.objectType === object.id)
                .map((ref) => ref.id),
            },
          })
          .pipe(Effect.map((page) => page.items)),
      { concurrency: 4 }
    )
    const byId = new Map(batches.flat().map((record) => [record.id, record]))
    return {
      items: ids.flatMap((id) => {
        const record = byId.get(RecordId("object")(id))
        return record ? [record] : []
      }),
      missingIds: ids.filter((id) => !byId.has(RecordId("object")(id))),
    }
  })
}
