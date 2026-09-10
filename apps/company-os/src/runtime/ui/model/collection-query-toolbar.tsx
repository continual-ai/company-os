import {
  useTable,
  type ColumnFiltersState,
  type OnChangeFn,
  type SortingState,
} from "@tanstack/react-table"
import { useMemo } from "react"

import type { ObjectType } from "#/runtime/model/index.ts"
import {
  canFilterProperty,
  canSortProperty,
} from "#/runtime/ui/model/object-collection-query.ts"
import {
  objectTableProperties,
  objectTablePropertyColumnDefs,
} from "#/runtime/ui/model/object-table/object-table-columns.ts"
import {
  objectTableFeatures,
  type ObjectTableRecord,
} from "#/runtime/ui/model/object-table/object-table-config.ts"
import { ObjectTableQueryToolbar } from "#/runtime/ui/model/object-table/object-table-toolbar.tsx"

export function CollectionQueryToolbar({
  object,
  parentLabel,
  records,
  columnFilters,
  sorting,
  onColumnFiltersChange,
  onSortingChange,
}: {
  object: ObjectType
  parentLabel: string | undefined
  records: ObjectTableRecord[]
  columnFilters: ColumnFiltersState
  sorting: SortingState
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  onSortingChange: OnChangeFn<SortingState>
}) {
  const columns = useMemo(
    () =>
      objectTablePropertyColumnDefs({
        object,
        properties: objectTableProperties(object, parentLabel),
        canFilterProperty,
        canSortProperty,
      }),
    [object, parentLabel]
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
