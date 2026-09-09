import { Schema } from "effect"

import { toEffectSchema } from "#/runtime/contract/schema.ts"
import { schema } from "#/runtime/model/index.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"

export function createRecordSearchContract(Model: ModelCatalog) {
  const searchableObjects = Object.values(Model.objects).filter(
    (object) => object.search !== undefined
  )

  const recordSearchInput = Schema.Struct({
    query: Schema.String.check(Schema.isMaxLength(200)),
    objectTypes: Schema.optionalKey(
      Schema.Array(
        Schema.Literals(searchableObjects.map((object) => object.id))
      ).check(Schema.isMaxLength(50))
    ),
    limit: Schema.optionalKey(
      Schema.Number.check(
        Schema.isInt(),
        Schema.isBetween({ minimum: 1, maximum: 50 })
      )
    ),
  })

  /** A display projection, never a partial canonical record to merge into the record cache. */
  const recordSummary = Schema.Struct({
    id: Schema.String,
    objectType: Schema.Literals(searchableObjects.map((object) => object.id)),
    title: Schema.String,
    subtitle: Schema.NullOr(Schema.String),
    image: toEffectSchema(schema.image({ nullable: true })),
    status: Schema.NullOr(Schema.String),
  })

  const recordSearchResult = Schema.Struct({
    hits: Schema.Array(recordSummary),
    hasMore: Schema.Boolean,
  })

  return {
    searchableObjects,
    input: recordSearchInput,
    result: recordSearchResult,
  }
}

type RecordSearchContract = ReturnType<typeof createRecordSearchContract>
export type RecordSearchInput = RecordSearchContract["input"]["Type"]
/** A display projection, never a partial canonical record to merge into the record cache. */
export type RecordSummary =
  RecordSearchContract["result"]["Type"]["hits"][number]
