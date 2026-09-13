import { Schema } from "effect"

import {
  expansionSchema,
  expandableRecordSchema,
} from "#/runtime/contract/expansion.ts"
import { MAX_PAGE_SIZE, type ModelCatalog } from "#/runtime/model/index.ts"

export const recordBatchInput = Schema.Struct({
  expand: Schema.optionalKey(expansionSchema),
  ids: Schema.Array(Schema.String.check(Schema.isMinLength(1))).check(
    Schema.isMaxLength(MAX_PAGE_SIZE)
  ),
})
export type RecordBatchInput = typeof recordBatchInput.Type

export function recordBatchResult(model: ModelCatalog) {
  return Schema.Struct({
    items: Schema.Array(
      Schema.Union(
        Object.values(model.objects).map((object) =>
          expandableRecordSchema(object, model)
        )
      )
    ),
    missingIds: Schema.Array(Schema.String),
  })
}
