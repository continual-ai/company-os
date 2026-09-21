import {
  modelObjectLinkTraversals,
  type ModelCatalog,
  type ModelLinkTraversal,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import type { PropertyDefinition } from "#/runtime/model/definition/property.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import {
  fieldOperators,
  queryProperty,
  resolveQueryField,
} from "#/runtime/model/query-fields.ts"

export interface RelatedField {
  readonly id: string
  readonly key: string
  readonly traversal: ModelLinkTraversal
  readonly property: PropertyDefinition
  readonly count: boolean
}

/** Shared fields of related Objects and Interfaces, used by collection columns, filters, and sorts. */
export function relatedFields(
  model: ModelCatalog,
  object: ObjectType
): ReadonlyArray<RelatedField> {
  return modelObjectLinkTraversals(model, object).flatMap((traversal) => {
    const target =
      model.objects[traversal.inverse.from.typeId] ??
      model.interfaces[traversal.inverse.from.typeId]
    if (!target) return []
    const fields: RelatedField[] = Object.entries(target.properties).flatMap(
      ([key, property]) =>
        fieldOperators(property).length > 0
          ? [
              {
                id: `${traversal.traversal.key}.${key}`,
                key,
                traversal,
                count: false,
                property: {
                  ...resolveQueryField(
                    model,
                    object,
                    `${traversal.traversal.key}.${key}`,
                    "preview"
                  ).property,
                  label: `${traversal.traversal.label} → ${property.label ?? key}`,
                  outputOnly: true,
                  immutable: true,
                  nullable:
                    traversal.traversal.max === 1
                      ? resolveQueryField(
                          model,
                          object,
                          `${traversal.traversal.key}.${key}`
                        ).property.nullable
                      : queryProperty(target, key)!.nullable,
                  requiredOnCreate: false,
                },
              },
            ]
          : []
    )
    if (traversal.traversal.max !== 1)
      fields.push({
        id: `${traversal.traversal.key}.$count`,
        key: "$count",
        traversal,
        count: true,
        property: {
          ...schema.number({ label: `${traversal.traversal.label} → Count` }),
          outputOnly: true,
          immutable: true,
          nullable: false,
          requiredOnCreate: false,
        },
      })
    return fields
  })
}
