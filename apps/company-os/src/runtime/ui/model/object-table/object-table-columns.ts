import { createColumnHelper } from "@tanstack/react-table"

import {
  schema,
  type ObjectType,
  type PropertyDefinition,
} from "#/runtime/model/index.ts"
import { objectTableCellType } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import {
  type objectTableFeatures,
  type ObjectTableRecord,
  type ObjectTableColumnMeta,
  type ObjectTableInstance,
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

export function objectTableProperties(
  object: ObjectType,
  parentLabel?: string
) {
  const entries = [
    ...(object.display.title === "id"
      ? [
          [
            "id",
            {
              ...schema.string({ label: "Record ID" }),
              immutable: true,
              nullable: false,
              outputOnly: true,
              requiredOnCreate: false,
            } satisfies PropertyDefinition,
          ] as const,
        ]
      : []),
    ...(object.parent.kind === "root"
      ? []
      : [
          [
            "parent",
            {
              ...schema.reference(
                { id: object.parent.typeId },
                { label: parentLabel ?? "Parent" }
              ),
              immutable: true,
              nullable: false,
              outputOnly: false,
              requiredOnCreate: true,
            } satisfies PropertyDefinition,
          ] as const,
        ]),
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
