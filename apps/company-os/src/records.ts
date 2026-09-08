import { schema } from "@company/runtime"
import { toEffectSchema } from "@company/runtime/effect"
import { Schema } from "effect"

import { Model } from "#/app.model.ts"

export const searchableObjects = Object.values(Model.objects).filter(
  (object) => object.search !== undefined
)

export const recordSearchInput = Schema.Struct({
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

export const recordSearchResult = Schema.Struct({
  hits: Schema.Array(recordSummary),
  hasMore: Schema.Boolean,
})

export type RecordSearchInput = typeof recordSearchInput.Type
export type RecordSummary = typeof recordSummary.Type
