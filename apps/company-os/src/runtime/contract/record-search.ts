import { Schema } from "effect"

import {
  paginationInputFields,
  pageSchema,
} from "#/runtime/contract/pagination.ts"
import { toEffectSchema } from "#/runtime/contract/schema.ts"
import { schema, type ModelCatalog } from "#/runtime/model/index.ts"

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
    ...paginationInputFields,
  })

  /** A display projection, never a partial canonical record to merge into the record cache. */
  const searchResult = Schema.Struct({
    id: Schema.String,
    objectType: Schema.Literals(searchableObjects.map((object) => object.id)),
    title: Schema.String,
    subtitle: Schema.NullOr(Schema.String),
    image: toEffectSchema(schema.image({ nullable: true })),
    status: Schema.NullOr(Schema.String),
    snippets: Schema.Array(
      Schema.Struct({ field: Schema.String, text: Schema.String })
    ).check(Schema.isMaxLength(3)),
  }).annotate({ identifier: "SearchResult" })

  const recordSearchResult = pageSchema(searchResult)

  return {
    searchableObjects,
    input: recordSearchInput,
    result: recordSearchResult,
  }
}

type RecordSearchContract = ReturnType<typeof createRecordSearchContract>
export type RecordSearchInput = RecordSearchContract["input"]["Type"]
/** A display projection, never a partial canonical record to merge into the record cache. */
export type SearchResult =
  RecordSearchContract["result"]["Type"]["items"][number]

export type RecordSearchOutput = RecordSearchContract["result"]["Type"]
