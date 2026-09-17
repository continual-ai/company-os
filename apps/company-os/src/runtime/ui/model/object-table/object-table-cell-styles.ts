import type { CSSProperties } from "react"

import type { ObjectTableColumn } from "#/runtime/ui/model/object-table/object-table-columns.ts"

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
