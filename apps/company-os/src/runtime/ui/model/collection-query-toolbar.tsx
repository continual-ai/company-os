import {
  useTable,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table"
import { useMemo } from "react"

import type { ObjectType } from "#/runtime/model/index.ts"
import { objectFields } from "#/runtime/model/object-fields.ts"
import { objectTableFieldColumnDef } from "#/runtime/ui/model/object-table/object-table-columns.ts"
import {
  objectTableFeatures,
  type ObjectTableRecord,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { ObjectTableQueryToolbar } from "#/runtime/ui/model/object-table/object-table-toolbar.tsx"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function CollectionQueryToolbar({
  object,
  records,
  columnFilters,
  sorting,
  onColumnFiltersChange,
  onSortingChange,
}: {
  object: ObjectType
  records: ReadonlyArray<ObjectTableRecord>
  columnFilters: ColumnFiltersState
  sorting: SortingState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  onSortingChange: OnChangeFn<SortingState>
}) {
  const runtime = useModelRuntime()
  const columns = useMemo(
    () =>
      objectFields(object, runtime.model).map((field) =>
        objectTableFieldColumnDef(object, field)
      ),
    [object, runtime.model]
  )
  // Share the table's query model and controls without rendering a table.
  const table = useTable({
    features: objectTableFeatures,
    columns,
    data: records,
    getRowId: (record) => record.id,
    enableMultiSort: true,
    enableSortingRemoval: true,
    manualFiltering: true,
    manualSorting: true,
    onColumnFiltersChange,
    onSortingChange,
    state: { columnFilters, sorting },
  })
  return <ObjectTableQueryToolbar object={object} table={table} />
}
