import { createColumnHelper } from "@tanstack/react-table"

import {
  schema,
  type modelObjectLinkTraversals,
  type ObjectType,
  type ModelCatalog,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import { relationshipFields } from "#/runtime/model/relationship-fields.ts"
import { objectTableCellType } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import {
  type ObjectTableColumnMeta,
  type objectTableFeatures,
  type ObjectTableInstance,
  type ObjectTableRecord,
  type ObjectTableRecordResolver,
} from "#/runtime/ui/model/object-table/object-table-config.ts"

export type ObjectTableColumn = ReturnType<
  ObjectTableInstance["getAllLeafColumns"]
>[number]

export function objectTableColumnMeta(
  column: ObjectTableColumn
): ObjectTableColumnMeta | undefined {
  return column.columnDef.meta
}

export function objectTablePropertyColumns(
  table: ObjectTableInstance,
  { includeReadonly = true }: { includeReadonly?: boolean } = {}
): ObjectTableColumn[] {
  return table.getAllLeafColumns().filter((column) => {
    const property = objectTableColumnMeta(column)?.property
    return (
      property !== undefined &&
      (includeReadonly || objectTableCellType(property) !== "readonly")
    )
  })
}

const columnHelper = createColumnHelper<
  typeof objectTableFeatures,
  ObjectTableRecord
>()

function propertyColumnSize(
  propertyId: string,
  propertyKind: string,
  titlePropertyId: string
): number {
  if (propertyId === titlePropertyId) return 276
  if (propertyKind === "enum") return 168
  if (propertyKind === "image") return 88
  return 200
}

export function objectTableProperties(object: ObjectType) {
  const entries = [
    ...(["id", "label"].includes(object.display.title)
      ? [
          [
            object.display.title,
            {
              ...schema.string({ label: object.name }),
              immutable: true,
              nullable: false,
              outputOnly: true,
              requiredOnCreate: false,
            } satisfies PropertyDefinition,
          ] as const,
        ]
      : []),
    ...Object.entries(object.properties),
  ]
  const titleEntry = entries.find(
    ([propertyId]) => propertyId === object.display.title
  )
  return titleEntry === undefined
    ? entries
    : [
        titleEntry,
        ...entries.filter(
          ([propertyId]) => propertyId !== object.display.title
        ),
      ]
}

export function objectTablePropertyColumnDefs({
  object,
  properties,
  canFilterProperty,
  canSortProperty,
}: {
  object: ObjectType
  properties: ReturnType<typeof objectTableProperties>
  canFilterProperty?: ((property: PropertyDefinition) => boolean) | undefined
  canSortProperty?: ((property: PropertyDefinition) => boolean) | undefined
}) {
  return columnHelper.columns(
    properties.map(([propertyId, property]) => {
      const isIdentity = propertyId === object.display.title
      const label = isIdentity ? object.name : (property.label ?? propertyId)

      return columnHelper.accessor((record) => record[propertyId], {
        id: propertyId,
        enableColumnFilter: canFilterProperty?.(property) ?? true,
        enableHiding: propertyId !== object.display.title,
        enableResizing: true,
        enableSorting: canSortProperty?.(property) ?? true,
        filterFn: "objectProperty",
        sortFn: "objectProperty",
        sortUndefined: "last",
        size: propertyColumnSize(
          propertyId,
          property.kind,
          object.display.title
        ),
        minSize: propertyId === object.display.title ? 176 : 120,
        maxSize: 560,
        header: label,
        meta: {
          essential: isIdentity,
          label,
          property,
          propertyId,
        },
      })
    })
  )
}

export function objectTableLinkColumnDef(
  link: ReturnType<typeof modelObjectLinkTraversals>[number]
) {
  return columnHelper.accessor(
    (record): unknown => record[link.traversal.key],
    {
      id: link.traversal.key,
      header: link.traversal.label,
      enableColumnFilter: true,
      enableSorting: false,
      enableHiding: true,
      enableResizing: true,
      size: 200,
      minSize: 120,
      maxSize: 560,
      meta: {
        label: link.traversal.label,
        property: {
          ...schema.id({
            id: link.traversal.to.typeId,
            label: link.traversal.label,
          }),
          nullable: true,
          immutable: false,
          outputOnly: false,
          requiredOnCreate: false,
        },
      },
    }
  )
}

export function objectTableRelationshipColumnDefs(
  model: ModelCatalog,
  object: ObjectType,
  resolveRecord?: ObjectTableRecordResolver
) {
  return relationshipFields(model, object).map((field) =>
    columnHelper.accessor(
      (record) => {
        if (field.count)
          return record[`${field.traversal.traversal.key}TotalSize`] ?? 0
        const ids = record[field.traversal.traversal.key]
        if (!Array.isArray(ids)) return null
        const values = ids.flatMap((id) => {
          const target = resolveRecord?.(id)
          if (!target) return []
          const mapping =
            target.object.interfaces[field.traversal.target.from.typeId]
              ?.propertyMapping ?? {}
          const value = target.record[mapping[field.key] ?? field.key]
          return value === null || value === undefined ? [] : [value]
        })
        if (field.traversal.traversal.max === 1) return values[0] ?? null
        const remaining =
          Number(
            record[`${field.traversal.traversal.key}TotalSize`] ?? ids.length
          ) - ids.length
        return [
          ...values.map(String),
          ...(remaining > 0 ? [`+${remaining} more`] : []),
        ]
      },
      {
        id: field.id,
        header: field.property.label ?? field.id,
        enableColumnFilter: true,
        enableSorting: field.count || field.traversal.traversal.max === 1,
        enableHiding: true,
        size: 200,
        minSize: 120,
        maxSize: 560,
        filterFn: "objectProperty",
        sortFn: "objectProperty",
        meta: {
          label: field.property.label!,
          ...(!field.count && field.traversal.traversal.max !== 1
            ? { relationship: field.traversal.traversal.label }
            : {}),
          property: field.property,
          ...(!field.count && field.traversal.traversal.max !== 1
            ? {
                displayProperty: {
                  ...schema.array(schema.string()),
                  label: field.property.label ?? field.id,
                  outputOnly: true,
                  immutable: true,
                  nullable: true,
                  requiredOnCreate: false,
                },
              }
            : {}),
          propertyId: field.id,
        },
      }
    )
  )
}
