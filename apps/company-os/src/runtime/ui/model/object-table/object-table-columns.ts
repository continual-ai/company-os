import { objectTableCellType } from "#/runtime/ui/model/object-table/object-table-cell-types.ts"
import type {
  ObjectTableColumnMeta,
  ObjectTableInstance,
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
