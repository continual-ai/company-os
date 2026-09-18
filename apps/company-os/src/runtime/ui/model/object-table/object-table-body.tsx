import { TableBody, TableCell, TableRow } from "@company/ui/table"
import { Fragment, useEffect, useLayoutEffect, type RefObject } from "react"

import type { ObjectTableInstance } from "#/runtime/ui/model/object-table/object-table-config.ts"
import type { useObjectTableNavigation } from "#/runtime/ui/model/object-table/object-table-navigation.ts"
import {
  ObjectTableRow,
  type ObjectTableRowProps,
} from "#/runtime/ui/model/object-table/object-table-row.tsx"
import { ObjectTableSkeletonRow } from "#/runtime/ui/model/object-table/object-table-skeleton-row.tsx"
import { useObjectTableRows } from "#/runtime/ui/model/object-table/object-table-virtualization.ts"
import type { ObjectTableProps } from "#/runtime/ui/model/object-table/object-table.tsx"

/** Keep scroll-driven updates below the table's configuration and navigation state. */
export function ObjectTableBody({
  rowIds,
  rowsByIndex,
  viewport,
  retainedRowIds,
  scrollRef,
  columnCount,
  pagination,
  rowProps,
  table,
  navigation,
  canUpdateRecord,
}: {
  viewport: ObjectTableProps["viewport"]
  rowIds: ReadonlyArray<string>
  rowsByIndex: ReadonlyMap<number, string>
  retainedRowIds: ReadonlyArray<string | undefined>
  scrollRef: RefObject<HTMLDivElement | null>
  columnCount: number
  pagination: ObjectTableProps["pagination"]
  table: ObjectTableInstance
  navigation: ReturnType<typeof useObjectTableNavigation>
  canUpdateRecord: ObjectTableProps["canUpdateRecord"]
  rowProps: Omit<
    ObjectTableRowProps,
    "row" | "rowIndex" | "selected" | "canUpdate" | "navigation"
  >
}) {
  const {
    rows,
    remainingHeight,
    firstVisibleIndex,
    lastVisibleIndex,
    retainedIndices,
    prefetchRowCount,
  } = useObjectTableRows(
    rowIds,
    rowsByIndex,
    retainedRowIds,
    scrollRef,
    viewport
  )

  // Subscribe before paint so jumping back to a cached page never flashes empty rows.
  useLayoutEffect(() => {
    viewport?.onRangeChange({
      startIndex: firstVisibleIndex,
      endIndex: lastVisibleIndex,
      prefetchRowCount,
      retainedIndices: [
        ...retainedIndices,
        ...Object.keys(table.state.rowSelection).flatMap((id) => {
          const index = viewport.indices.get(id)
          return index === undefined ? [] : [index]
        }),
      ],
    })
  }, [
    firstVisibleIndex,
    lastVisibleIndex,
    prefetchRowCount,
    retainedIndices,
    table.state.rowSelection,
    viewport,
  ])

  useEffect(() => {
    if (
      !viewport &&
      rowIds.length > 0 &&
      lastVisibleIndex >= rowIds.length - prefetchRowCount &&
      pagination?.hasNextPage &&
      !pagination.loading &&
      pagination.error === undefined
    )
      pagination.onNextPage()
  }, [lastVisibleIndex, rowIds.length, prefetchRowCount, pagination, viewport])

  const tableRows = table.getRowModel().rowsById
  const columns = table.getVisibleLeafColumns()
  return (
    <TableBody>
      {rows.map((row) => {
        const id = rowsByIndex.get(row.index)
        const record = id === undefined ? undefined : tableRows[id]
        return (
          <Fragment key={record?.id ?? row.index}>
            {row.gap > 0 && (
              <TableRow aria-hidden="true">
                <TableCell
                  colSpan={columnCount}
                  className="border-0 p-0"
                  style={{ height: row.gap }}
                />
              </TableRow>
            )}
            {record !== undefined ? (
              <ObjectTableRow
                {...rowProps}
                row={record}
                rowIndex={row.index}
                selected={table.state.rowSelection[record.id] ?? false}
                canUpdate={canUpdateRecord?.(record.id)}
                navigation={navigation.actions}
                activeColumn={
                  navigation.activeCell?.rowId === record.id
                    ? navigation.activeCell.columnId
                    : undefined
                }
                tabbableColumn={
                  navigation.tabbableCell?.rowId === record.id
                    ? navigation.tabbableCell.columnId
                    : undefined
                }
                editingColumn={
                  navigation.editingCell?.rowId === record.id
                    ? navigation.editingCell.columnId
                    : undefined
                }
                initialEditValue={
                  navigation.editingCell?.rowId === record.id
                    ? navigation.editingCell.initialValue
                    : undefined
                }
              />
            ) : (
              <ObjectTableSkeletonRow rowIndex={row.index} columns={columns} />
            )}
          </Fragment>
        )
      })}
      {rows.length > 0 && (
        <TableRow aria-hidden="true">
          <TableCell
            colSpan={columnCount}
            className="border-0 p-0"
            style={{ height: remainingHeight }}
          />
        </TableRow>
      )}
    </TableBody>
  )
}
