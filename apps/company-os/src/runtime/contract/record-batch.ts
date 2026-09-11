import { Schema } from "effect"

import { toEffectObjectSchema } from "#/runtime/contract/schema.ts"
import { MAX_PAGE_SIZE, type ModelCatalog } from "#/runtime/model/index.ts"

export const recordBatchInput = Schema.Struct({
  ids: Schema.Array(Schema.String.check(Schema.isMinLength(1))).check(
    Schema.isMaxLength(MAX_PAGE_SIZE)
  ),
})
export type RecordBatchInput = typeof recordBatchInput.Type

export function recordBatchResult(model: ModelCatalog) {
  return Schema.Struct({
    items: Schema.Array(
      Schema.Union(Object.values(model.objects).map(toEffectObjectSchema))
    ),
    missingIds: Schema.Array(Schema.String),
  })
}
