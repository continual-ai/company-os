import { TableBody, TableCell, TableRow } from "@company/ui/table"
import { Fragment, useEffect, type RefObject } from "react"

import {
  ObjectTableRow,
  type ObjectTableRowProps,
} from "#/runtime/ui/model/object-table/object-table-row.tsx"
import { useObjectTableRows } from "#/runtime/ui/model/object-table/object-table-virtualization.ts"
import type { ObjectTableProps } from "#/runtime/ui/model/object-table/object-table.tsx"

/** Keep scroll-driven updates below the table's configuration and navigation state. */
export function ObjectTableBody({
  rowIds,
  retainedRowIds,
  scrollRef,
  columnCount,
  pagination,
  rowProps,
}: {
  rowIds: ReadonlyArray<string>
  retainedRowIds: ReadonlyArray<string | undefined>
  scrollRef: RefObject<HTMLDivElement | null>
  columnCount: number
  pagination: ObjectTableProps["pagination"]
  rowProps: Omit<ObjectTableRowProps, "row" | "rowIndex">
}) {
  const { rows, remainingHeight, lastVisibleIndex, prefetchRowCount } =
    useObjectTableRows(rowIds, retainedRowIds, scrollRef)

  useEffect(() => {
    if (
      rowIds.length > 0 &&
      lastVisibleIndex >= rowIds.length - prefetchRowCount &&
      pagination?.hasNextPage &&
      !pagination.loading &&
      pagination.error === undefined
    )
      pagination.onNextPage()
  }, [lastVisibleIndex, rowIds.length, prefetchRowCount, pagination])

  const tableRows = rowProps.table.getRowModel().rows
  return (
    <TableBody>
      {rows.map((row) => (
        <Fragment key={rowIds[row.index]}>
          {row.gap > 0 && (
            <TableRow aria-hidden="true">
              <TableCell
                colSpan={columnCount}
                className="border-0 p-0"
                style={{ height: row.gap }}
              />
            </TableRow>
          )}
          <ObjectTableRow
            {...rowProps}
            row={tableRows[row.index]!}
            rowIndex={row.index}
          />
        </Fragment>
      ))}
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
