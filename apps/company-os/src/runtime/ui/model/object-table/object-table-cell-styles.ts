import { useMemo, type CSSProperties } from "react"

import type { ObjectTableColumn } from "#/runtime/ui/model/object-table/object-table-columns.ts"
import type { ObjectTableInstance } from "#/runtime/ui/model/object-table/object-table-config.ts"

export const objectTableRowClassName =
  "group h-8 hover:bg-muted/30 [&>td]:inset-shadow-[0_-1px_var(--border)]"

export const objectTableCellSelectionClassName =
  "bg-selection outline-1 -outline-offset-1 outline-solid outline-interactive"

export const objectTablePinnedCellClassName =
  "z-10 bg-background group-hover:bg-[color-mix(in_oklab,var(--muted)_30%,var(--background))] group-data-[state=selected]:bg-muted"

export function objectTablePinnedColumnStyle(
  column: ObjectTableColumn
): CSSProperties {
  const pinned = column.getIsPinned()

  return {
    width: column.getSize(),
    position: pinned ? "sticky" : "relative",
    insetInlineStart: pinned === "start" ? column.getStart("start") : undefined,
    insetInlineEnd: pinned === "end" ? column.getAfter("end") : undefined,
  }
}

/** Materialize mutable column getters when their layout state changes, never on row selection. */
export function useObjectTableColumnLayout(table: ObjectTableInstance) {
  "use no memo"
  const columns = table.getVisibleLeafColumns()
  const { columnSizing, columnPinning } = table.state
  return useMemo(
    () =>
      new Map(
        columns.map((column) => [
          column.id,
          {
            pinned: !!column.getIsPinned(),
            style: objectTablePinnedColumnStyle(column),
          },
        ])
      ),
    // These immutable snapshots invalidate TanStack's mutable column getters.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
    [columns, columnSizing, columnPinning]
  )
}
