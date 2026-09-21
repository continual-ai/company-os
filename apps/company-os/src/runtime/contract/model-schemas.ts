import { Schema } from "effect"

import {
  expansionInputSchema,
  expandableRecordSchema,
} from "#/runtime/contract/expansion.ts"
import {
  paginationInputFields,
  pageSchema,
} from "#/runtime/contract/pagination.ts"
import { validateQuery } from "#/runtime/contract/query-validation.ts"
import {
  toEffectRecordIdentifierSchema,
  toEffectObjectSchema,
} from "#/runtime/contract/schema.ts"
import {
  modelObjects,
  modelTypeAccepts,
  type ModelCatalog,
  type ModelLinkTraversal,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  filterOperators,
  MAX_BATCH_GET_SIZE,
  nullPlacements,
  sortDirections,
} from "#/runtime/model/definition/request.ts"
import type { AnySchema } from "#/runtime/model/definition/schema.ts"

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

export function objectGetInputSchema(object: ObjectType, model: ModelCatalog) {
  return Schema.Struct({
    expand: Schema.optionalKey(expansionInputSchema(model, object)),
    id: toEffectRecordIdentifierSchema(object.id).annotate({
      title: `${object.name} ID or alias`,
    }),
  }).annotate({ identifier: `${pascalCase(object.id)}GetInput` })
}

export function objectBatchGetInputSchema(
  object: ObjectType,
  model: ModelCatalog
) {
  return Schema.Struct({
    expand: Schema.optionalKey(expansionInputSchema(model, object)),
    ids: Schema.Array(
      toEffectRecordIdentifierSchema(object.id).annotate({
        title: `${object.name} ID or alias`,
      })
    ).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_BATCH_GET_SIZE)),
  }).annotate({ identifier: `${pascalCase(object.id)}BatchGetInput` })
}

export function objectListInputSchema(
  object: {
    readonly id: string
    readonly name: string
    readonly properties: Readonly<Record<string, AnySchema>>
  },
  model: ModelCatalog
) {
  const field = Schema.String.check(Schema.isNonEmpty()).annotate({
    description: `A declared property or dot-separated path through singular links (at most three traversals). Aggregate sorts may traverse a plural link. Use link.$count to filter counts. Properties: ${Object.keys(object.properties).join(", ")}.`,
    identifier: `${pascalCase(object.id)}FilterField`,
  })
  let filter: Schema.Codec<unknown, unknown>
  filter = Schema.suspend(() =>
    Schema.Union([
      Schema.Struct({ link: Schema.String, contains: Schema.String }),
      Schema.Struct({ link: Schema.String, isEmpty: Schema.Literal(true) }),
      Schema.Struct({
        link: Schema.String,
        some: Schema.Union([
          filter,
          Schema.Record(Schema.String, Schema.Never),
        ]),
      }),
      Schema.Struct({
        link: Schema.String,
        none: Schema.Union([
          filter,
          Schema.Record(Schema.String, Schema.Never),
        ]),
      }),
      Schema.Struct({
        link: Schema.String,
        every: Schema.Union([
          filter,
          Schema.Record(Schema.String, Schema.Never),
        ]),
      }),
      Schema.Struct({ and: Schema.Array(filter) }).annotate({
        identifier: `${pascalCase(object.id)}AndFilter`,
      }),
      Schema.Struct({ not: filter }).annotate({
        identifier: `${pascalCase(object.id)}NotFilter`,
      }),
      Schema.Struct({ or: Schema.Array(filter) }).annotate({
        identifier: `${pascalCase(object.id)}OrFilter`,
      }),
      Schema.Struct({
        field,
        operator: Schema.Literals(filterOperators).annotate({
          identifier: `${pascalCase(object.id)}FilterOperator`,
        }),
        value: Schema.optionalKey(Schema.Unknown),
      }).annotate({
        identifier: `${pascalCase(object.id)}FieldFilter`,
      }),
    ]).annotate({
      identifier: `${pascalCase(object.id)}FilterExpression`,
    })
  ).annotate({ identifier: `${pascalCase(object.id)}Filter` })

  return Schema.Struct({
    expand: Schema.optionalKey(expansionInputSchema(model, object)),
    filter: Schema.optionalKey(filter),
    query: Schema.optionalKey(
      Schema.String.check(Schema.isMaxLength(200))
    ).annotate({
      description:
        "Full-text word-prefix search across indexed fields. Combined with filters; preserves list ordering.",
    }),
    ...paginationInputFields,
    sort: Schema.optionalKey(
      Schema.Array(
        Schema.Struct({
          aggregate: Schema.optionalKey(
            Schema.Literals(["count", "min", "max"])
          ),
          direction: Schema.Literals(sortDirections),
          field,
          nulls: Schema.optionalKey(Schema.Literals(nullPlacements)),
        })
      )
    ),
  })
    .check(
      Schema.makeFilter((input) => {
        try {
          validateQuery(model, object, input)
          return true
        } catch (error) {
          return error instanceof Error ? error.message : "Invalid query."
        }
      })
    )
    .annotate({ identifier: `${pascalCase(object.id)}ListInput` })
}

/** Link queries reuse the target object's list contract. */
export function linkListInputSchema(
  model: ModelCatalog,
  traversal: ModelLinkTraversal
) {
  const target = modelObjects(model).find(
    (object) => object.id === traversal.inverse.from.typeId
  )
  return objectListInputSchema(
    target ?? model.interfaces[traversal.inverse.from.typeId]!,
    model
  )
}

export function objectRecordOutputSchema(
  object: ObjectType,
  model: ModelCatalog,
  expandable = false
) {
  return expandable
    ? expandableRecordSchema(object, model)
    : toEffectObjectSchema(object, model)
}

export function objectBatchOutputSchema(
  object: ObjectType,
  model: ModelCatalog
) {
  return Schema.Struct({
    items: Schema.Array(expandableRecordSchema(object, model)),
  }).annotate({ identifier: `${pascalCase(object.id)}Batch` })
}

export function objectPageOutputSchema(
  object: ObjectType,
  model: ModelCatalog
) {
  return pageSchema(expandableRecordSchema(object, model)).annotate({
    identifier: `${pascalCase(object.id)}Page`,
  })
}

/** Link pages contain discriminated, complete target records. */
export function linkPageOutputSchema(
  model: ModelCatalog,
  traversal: ModelLinkTraversal
) {
  const targets = modelObjects(model).filter((object) =>
    modelTypeAccepts(model, object.id, traversal.inverse.from.typeId)
  )
  const records = targets.map((object) => expandableRecordSchema(object, model))
  return pageSchema(Schema.Union(records))
}
