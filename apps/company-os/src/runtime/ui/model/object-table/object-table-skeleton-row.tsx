import { cn } from "@company/ui/lib/utils"
import { Skeleton } from "@company/ui/skeleton"
import { TableCell, TableRow } from "@company/ui/table"

import {
  objectTablePinnedCellClassName,
  objectTablePinnedColumnStyle,
  objectTableRowClassName,
} from "#/runtime/ui/model/object-table/object-table-cell-styles.ts"
import { ObjectTableCellSurface } from "#/runtime/ui/model/object-table/object-table-cell-surface.tsx"
import type { ObjectTableColumn } from "#/runtime/ui/model/object-table/object-table-columns.ts"

export function ObjectTableSkeletonRow({
  columns,
  rowIndex,
}: {
  columns: ReadonlyArray<ObjectTableColumn>
  rowIndex: number
}) {
  return (
    <TableRow
      aria-rowindex={rowIndex + 2}
      aria-label="Loading row"
      aria-busy="true"
      className={objectTableRowClassName}
    >
      {columns.map((column) => {
        const meta = column.columnDef.meta
        const selection = column.id === "selection"
        const identity = meta?.essential || meta?.link !== undefined
        return (
          <TableCell
            key={column.id}
            className={cn(
              "h-8 overflow-hidden p-0",
              !selection && "border-r",
              column.getIsPinned() && objectTablePinnedCellClassName
            )}
            style={objectTablePinnedColumnStyle(column)}
          >
            {selection ? (
              <div
                aria-hidden="true"
                className="flex h-8 items-center pl-3 sm:pl-5"
              >
                <Skeleton className="size-4 shrink-0 motion-reduce:animate-none" />
              </div>
            ) : (
              <ObjectTableCellSurface active={false} expandActive={false}>
                <div
                  aria-hidden="true"
                  className="flex w-full min-w-0 items-center gap-1.5"
                >
                  {identity && (
                    <Skeleton className="size-5 shrink-0 motion-reduce:animate-none" />
                  )}
                  <Skeleton
                    className={cn(
                      "max-w-full motion-reduce:animate-none",
                      meta?.property?.kind === "enum" ? "h-5 w-16" : "h-3 w-2/3"
                    )}
                  />
                </div>
              </ObjectTableCellSurface>
            )}
          </TableCell>
        )
      })}
      <TableCell className="h-8 border-r p-0" />
    </TableRow>
  )
}
