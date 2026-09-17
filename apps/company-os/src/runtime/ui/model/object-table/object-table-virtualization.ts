import { defaultRangeExtractor, useVirtualizer } from "@tanstack/react-virtual"
import { useCallback, type RefObject } from "react"

export const tableHeaderHeight = 33
export const tableRowHeight = 32

/** Materialize Virtual's mutable instance into values that the compiled table can safely consume. */
export function useObjectTableRows(
  rowIds: ReadonlyArray<string>,
  retainedRowIds: ReadonlyArray<string | undefined>,
  scrollRef: RefObject<HTMLDivElement | null>
) {
  "use no memo"
  // Virtual v3's mutable getters are incompatible with React Compiler memoization.
  const getItemKey = useCallback((index: number) => rowIds[index]!, [rowIds])
  const retainedRows = retainedRowIds.flatMap((id) => {
    const index = id === undefined ? -1 : rowIds.indexOf(id)
    return index < 0 ? [] : [index]
  })
  // This uncompiled boundary exposes values, never the mutable instance or its getters.
  // oxlint-disable-next-line react/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowIds.length,
    getScrollElement: () => scrollRef.current,
    getItemKey,
    estimateSize: () => tableRowHeight,
    overscan: 10,
    initialRect: { width: 0, height: 640 },
    scrollMargin: tableHeaderHeight,
    scrollPaddingStart: tableHeaderHeight,
    // Focused cells and unsaved editors survive scrolling out of the viewport.
    rangeExtractor: (range) =>
      [
        ...new Set([
          // Keep a viewport ready in both directions for fast scrolling.
          ...defaultRangeExtractor({
            ...range,
            overscan: Math.max(
              range.overscan,
              range.endIndex - range.startIndex + 1
            ),
          }),
          ...retainedRows,
        ]),
      ].sort((a, b) => a - b),
  })
  const items = virtualizer.getVirtualItems()
  return {
    lastVisibleIndex: virtualizer.range?.endIndex ?? -1,
    // Keep data farther ahead than the render buffer so page loads overlap scrolling.
    prefetchRowCount:
      4 * Math.ceil((virtualizer.scrollRect?.height ?? 640) / tableRowHeight),
    rows: items.map((item, index) => ({
      index: item.index,
      gap: item.start - (items[index - 1]?.end ?? tableHeaderHeight),
    })),
    remainingHeight: Math.max(
      0,
      virtualizer.getTotalSize() -
        ((items.at(-1)?.end ?? tableHeaderHeight) - tableHeaderHeight)
    ),
  }
}
