import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"

import { linkPreview } from "#/runtime/model/record-links.ts"
import { CollectionPagination } from "#/runtime/ui/model/collection-pagination.tsx"
import { formatTotalSize } from "#/runtime/ui/model/format-total-size.ts"
import { RelationshipCount } from "#/runtime/ui/model/record-relationship-previews.tsx"

it("formats exact and lower-bound counts consistently in pills and pagination", () => {
  for (const totalSizeExact of [true, false]) {
    const count = { totalSize: 10_000, totalSizeExact }
    const text = `${(10_000).toLocaleString()}${totalSizeExact ? "" : "+"}`
    expect(formatTotalSize(count)).toBe(text)
    expect(renderToStaticMarkup(<RelationshipCount count={count} />)).toContain(
      text
    )
    for (const hasNextPage of [true, false]) {
      const html = renderToStaticMarkup(
        <CollectionPagination
          loaded={50}
          {...count}
          hasNextPage={hasNextPage}
          loading={false}
          onNextPage={() => {}}
        />
      )
      expect(html).toContain(`50 of ${text}`)
      expect(html.includes("Load more")).toBe(hasNextPage)
    }
  }
  expect(formatTotalSize({ totalSize: 0, totalSizeExact: true })).toBe("0")
})

it("preserves lower bounds when reading raw and expanded relationship previews", () => {
  const count = { totalSize: 10_000, totalSizeExact: false }
  const raw = { ids: ["one"], ...count }
  expect(linkPreview(raw)).toEqual(raw)
  expect(linkPreview({ items: [{ id: "one" }], ...count })).toEqual(raw)
  expect(linkPreview(null)).toEqual({
    ids: [],
    totalSize: 0,
    totalSizeExact: true,
  })
  expect(linkPreview("one")).toEqual({
    ids: ["one"],
    totalSize: 1,
    totalSizeExact: true,
  })
})
