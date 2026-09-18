import type { Page } from "#/runtime/model/definition/request.ts"

/** Inexact totals are guaranteed lower bounds, not estimates. */
export function formatTotalSize({
  totalSize,
  totalSizeExact,
}: Pick<Page<unknown>, "totalSize" | "totalSizeExact">): string {
  return `${totalSize.toLocaleString()}${totalSizeExact ? "" : "+"}`
}
