import { createColumnHelper } from "@tanstack/react-table"

import { type ObjectType } from "#/runtime/model/index.ts"
import type { ObjectField } from "#/runtime/model/object-fields.ts"
import { objectFieldValue } from "#/runtime/ui/model/object-field-value.ts"
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
  table: ObjectTableInstance
): ObjectTableColumn[] {
  return table
    .getAllLeafColumns()
    .filter((column) => objectTableColumnMeta(column)?.property !== undefined)
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

export function objectTableFieldColumnDef(
  object: ObjectType,
  field: ObjectField,
  resolveRecord?: ObjectTableRecordResolver
) {
  const { id, property } = field
  const isIdentity = id === object.display.title
  const label = isIdentity ? object.name : (property.label ?? id)
  return columnHelper.accessor(
    (record): unknown => {
      const value = objectFieldValue(field, record, resolveRecord)
      switch (value.kind) {
        case "scalar":
          return value.value
        case "count":
          return value.totalSize
        case "link":
          return value.ids
        default:
          return value.values
      }
    },
    {
      id,
      header: label,
      enableColumnFilter: field.filterable,
      enableSorting: field.sortable,
      enableHiding: !isIdentity,
      enableResizing: true,
      filterFn: "objectProperty",
      sortFn: "objectProperty",
      sortUndefined: "last",
      size: propertyColumnSize(id, property.kind, object.display.title),
      minSize: isIdentity ? 176 : 120,
      maxSize: 560,
      meta: {
        field,
        label,
        property,
        essential: isIdentity,
        editable: field.kind === "property",
        ...(field.kind === "link"
          ? { link: field.traversal }
          : { propertyId: id }),
      },
    }
  )
}
