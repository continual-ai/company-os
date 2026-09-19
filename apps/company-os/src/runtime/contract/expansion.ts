import { Schema } from "effect"

import { totalSizeFields } from "#/runtime/contract/pagination.ts"
import {
  toEffectObjectFields,
  toEffectObjectSchema,
} from "#/runtime/contract/schema.ts"
import {
  modelObjectLinkTraversals,
  modelTypeAccepts,
  type ModelCatalog,
  type ObjectType,
  type ObjectRecord,
} from "#/runtime/model/index.ts"

export const expansionSchema = Schema.Union([
  Schema.Boolean,
  Schema.Record(Schema.String, Schema.Literal(true)),
]).annotate({
  identifier: "Expansion",
  description:
    "True expands all immediate relationships; an object of relationship keys set to true selects relationships. One hop only, hydrating the existing plural previews. At most 1000 distinct targets per request. Unknown relationships and unavailable targets fail the request.",
})

/** A closed key map makes expansion discoverable in OpenAPI and MCP, including on empty pages. */
export function expansionInputSchema(
  model: ModelCatalog,
  type: { readonly id: string }
) {
  const object = model.objects[type.id]
  const keys = Object.values(model.links)
    .flatMap((link) => [link.forward, link.reverse])
    .filter(
      (end) =>
        end.from.typeId === type.id ||
        (end.from.kind === "interface" &&
          object &&
          Object.hasOwn(object.interfaces, end.from.typeId))
    )
    .map((end) => end.key)
  return Schema.Union([
    Schema.Boolean,
    Schema.StructWithRest(
      Schema.Struct(
        Object.fromEntries(
          keys.map((key) => [key, Schema.optionalKey(Schema.Literal(true))])
        )
      ),
      [Schema.Record(Schema.String, Schema.Literal(true))]
    ).check(Schema.isPropertyNames(Schema.Literals(keys))),
  ]).annotate({
    identifier: `${type.id[0]!.toUpperCase()}${type.id.slice(1)}Expansion`,
    description:
      "Expand all immediate relationships with true, or select keys. Plural expansion hydrates up to three preview records and retains totalSize and totalSizeExact; nested records remain unexpanded. At most 1000 distinct targets per request.",
  })
}

const recordSchemas = new WeakMap<
  ModelCatalog,
  Map<ObjectType, Schema.Codec<unknown, unknown>>
>()

/** Nested records use canonical schemas so expansion is bounded even for cyclic models. */
export function expandableRecordSchema<O extends ObjectType>(
  object: O,
  model: ModelCatalog
): Schema.Codec<ObjectRecord<O>, unknown>
export function expandableRecordSchema(
  object: ObjectType,
  model: ModelCatalog
): Schema.Codec<unknown, unknown> {
  const cached = recordSchemas.get(model)?.get(object)
  if (cached) return cached
  const fields = toEffectObjectFields(object, model)
  const result = Schema.Struct({
    ...fields,
    links: Schema.Struct(
      Object.fromEntries(
        modelObjectLinkTraversals(model, object).map(
          ({ traversal, target }) => {
            const records = Schema.Union(
              Object.values(model.objects)
                .filter((candidate) =>
                  modelTypeAccepts(model, candidate.id, target.from.typeId)
                )
                .map((candidate) => toEffectObjectSchema(candidate, model))
            )
            const ids = Schema.String
            return [
              traversal.key,
              traversal.max === 1
                ? Schema.NullOr(Schema.Union([ids, records]))
                : Schema.Union([
                    Schema.Struct({
                      ids: Schema.Array(ids).check(Schema.isMaxLength(3)),
                      ...totalSizeFields,
                    }),
                    Schema.Struct({
                      items: Schema.Array(records).check(Schema.isMaxLength(3)),
                      ...totalSizeFields,
                    }),
                  ]),
            ]
          }
        )
      )
    ),
  }).annotate({
    identifier: `${object.id[0]!.toUpperCase()}${object.id.slice(1)}Expandable`,
  })
  const entries = recordSchemas.get(model) ?? new Map()
  entries.set(object, result)
  recordSchemas.set(model, entries)
  return result
}
