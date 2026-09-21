import {
  modelObjectLinkTraversals,
  type ModelCatalog,
  type ModelLinkTraversal,
} from "#/runtime/model/definition/model.ts"
import type { ObjectType } from "#/runtime/model/definition/object.ts"
import {
  normalizeProperties,
  type PropertyDefinition,
} from "#/runtime/model/definition/property.ts"
import { schema } from "#/runtime/model/definition/schema.ts"
import { fieldOperators, queryProperty } from "#/runtime/model/query-fields.ts"
import { recordProperties } from "#/runtime/model/record-properties.ts"
import {
  relatedFields,
  type RelatedField,
} from "#/runtime/model/related-fields.ts"

type FieldSource =
  | { readonly kind: "property" }
  | { readonly kind: "record" }
  | { readonly kind: "link"; readonly traversal: ModelLinkTraversal }
  | { readonly kind: "related"; readonly related: RelatedField }

export type ObjectField = FieldSource & {
  readonly id: string
  readonly property: PropertyDefinition
  readonly filterable: boolean
  readonly sortable: boolean
}

/** One catalog for field discovery, view validation, columns, and query controls. */
export function objectFields(
  object: ObjectType,
  model?: ModelCatalog
): ReadonlyArray<ObjectField> {
  const properties: ObjectField[] = Object.entries({
    ...object.properties,
    ...recordProperties,
  }).map(([id, property]) => {
    const query = queryProperty(object, id)
    const scalar = query !== undefined && fieldOperators(query).length > 0
    return {
      id,
      property,
      kind: Object.hasOwn(recordProperties, id) ? "record" : "property",
      filterable: scalar,
      sortable: scalar,
    }
  })
  const title = properties.findIndex(({ id }) => id === object.display.title)
  if (title > 0) properties.unshift(...properties.splice(title, 1))
  if (!model) return properties
  return [
    ...properties,
    ...relatedFields(model, object).map((related): ObjectField => ({
      kind: "related",
      id: related.id,
      property: related.property,
      related,
      filterable: true,
      sortable: related.count || related.traversal.traversal.max === 1,
    })),
    ...modelObjectLinkTraversals(model, object).map(
      (traversal): ObjectField => ({
        kind: "link",
        id: traversal.traversal.key,
        traversal,
        property: normalizeProperties({
          value: schema.id(
            { id: traversal.traversal.to.typeId },
            { label: traversal.traversal.label, nullable: true }
          ),
        }).value,
        filterable: true,
        sortable: false,
      })
    ),
  ]
}

export function requireObjectField(
  fields: ReadonlyArray<ObjectField>,
  id: string,
  use: "display" | "filter" | "sort" = "display"
): ObjectField {
  const field = fields.find((candidate) => candidate.id === id)
  if (!field) throw new Error(`Unknown field '${id}'.`)
  if (
    (use === "filter" && !field.filterable) ||
    (use === "sort" && !field.sortable)
  )
    throw new Error(`Field '${id}' does not support ${use}.`)
  return field
}
