import { Schema } from "effect"

import {
  modelObjects,
  modelTypeAccepts,
  type ModelCatalog,
  type ModelLinkTraversal,
} from "./definition/model"
import type { ObjectType } from "./definition/object"
import {
  DEFAULT_PAGE_SIZE,
  filterOperators,
  MAX_BATCH_GET_SIZE,
  MAX_PAGE_SIZE,
  nullPlacements,
  PageToken,
  sortDirections,
} from "./definition/request"
import {
  toEffectObjectSchema,
  toEffectObjectFields,
  toEffectRecordIdentifierSchema,
} from "./effect-schema"

function pascalCase(value: string): string {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

const pageTokenSchema = Schema.String.pipe(
  Schema.fromBrand("PageToken", PageToken)
)
const pageTotalSizeSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
).annotate({
  description:
    "Exact number of matching items visible to the caller before pagination.",
  identifier: "PageTotalSize",
})
export const pageSizeSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
).annotate({
  default: DEFAULT_PAGE_SIZE,
  description: `Maximum number of records to return. Zero uses the default of ${DEFAULT_PAGE_SIZE}; values above ${MAX_PAGE_SIZE} are capped.`,
  identifier: "PageSize",
})
const recordSchemas = new WeakMap<
  ObjectType,
  ReturnType<typeof toEffectObjectSchema>
>()

export function objectGetInputSchema(object: ObjectType) {
  return Schema.Struct({
    id: toEffectRecordIdentifierSchema(object.id).annotate({
      title: `${object.name} ID or alias`,
    }),
  }).annotate({ identifier: `${pascalCase(object.id)}GetInput` })
}

export function objectBatchGetInputSchema(object: ObjectType) {
  return Schema.Struct({
    ids: Schema.Array(
      toEffectRecordIdentifierSchema(object.id).annotate({
        title: `${object.name} ID or alias`,
      })
    ).check(Schema.isMinLength(1), Schema.isMaxLength(MAX_BATCH_GET_SIZE)),
  }).annotate({ identifier: `${pascalCase(object.id)}BatchGetInput` })
}

export function objectListInputSchema(object: ObjectType) {
  const fields = [
    "createdAt",
    "createdBy",
    "id",
    "parent",
    "systemManaged",
    "updatedAt",
    "updatedBy",
    ...Object.keys(object.properties),
  ]
  const field = Schema.Literals(fields).annotate({
    description: `A declared ${object.name.toLowerCase()} property or standard record field.`,
    identifier: `${pascalCase(object.id)}FilterField`,
  })
  let filter: Schema.Codec<unknown, unknown>
  filter = Schema.suspend(() =>
    Schema.Union([
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
    filter: Schema.optionalKey(filter),
    pageSize: Schema.optionalKey(pageSizeSchema),
    pageToken: Schema.optionalKey(pageTokenSchema),
    sort: Schema.optionalKey(
      Schema.Array(
        Schema.Struct({
          direction: Schema.Literals(sortDirections),
          field,
          nulls: Schema.optionalKey(Schema.Literals(nullPlacements)),
        })
      )
    ),
  }).annotate({ identifier: `${pascalCase(object.id)}ListInput` })
}

/** Link queries reuse the target object's list contract. */
export function linkListInputSchema(
  model: ModelCatalog,
  traversal: ModelLinkTraversal
) {
  const target = modelObjects(model).find(
    (object) => object.id === traversal.target.from.typeId
  )
  return target ? objectListInputSchema(target) : undefined
}

export function objectRecordOutputSchema(object: ObjectType) {
  const cached = recordSchemas.get(object)
  if (cached !== undefined) return cached
  const record = toEffectObjectSchema(object)
  recordSchemas.set(object, record)
  return record
}

export function objectBatchOutputSchema(object: ObjectType) {
  return Schema.Struct({
    items: Schema.Array(objectRecordOutputSchema(object)),
  }).annotate({ identifier: `${pascalCase(object.id)}Batch` })
}

export function objectPageOutputSchema(object: ObjectType) {
  return Schema.Struct({
    items: Schema.Array(objectRecordOutputSchema(object)),
    nextPageToken: Schema.NullOr(pageTokenSchema).annotate({
      identifier: "PageContinuation",
    }),
    totalSize: pageTotalSizeSchema,
  }).annotate({ identifier: `${pascalCase(object.id)}Page` })
}

/** Relationship pages contain discriminated, complete target records. */
export function linkPageOutputSchema(
  model: ModelCatalog,
  traversal: ModelLinkTraversal
) {
  const targets = modelObjects(model).filter((object) =>
    modelTypeAccepts(model, object.id, traversal.target.from.typeId)
  )
  const records = targets.map((object) =>
    Schema.Struct({
      ...toEffectObjectFields(object),
      objectType: Schema.Literal(object.id),
    })
  )
  return Schema.Struct({
    items: Schema.Array(Schema.Union(records)),
    nextPageToken: Schema.NullOr(pageTokenSchema),
    totalSize: pageTotalSizeSchema,
  })
}
