import { objectTableCellType } from "./object-table-cell-types"
import type {
  ObjectTableColumnMeta,
  ObjectTableInstance,
} from "./object-table-config"

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
