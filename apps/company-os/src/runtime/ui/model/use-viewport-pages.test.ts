import { expect, it } from "vitest"

import { PageToken } from "#/runtime/model/index.ts"
import {
  viewportPageIndices,
  viewportSize,
} from "#/runtime/ui/model/use-viewport-pages.ts"

it("preloads four screens on both sides without subscribing to the intervening collection", () => {
  const pages = viewportPageIndices(
    {
      startIndex: 1050,
      endIndex: 1084,
      prefetchRowCount: 140,
      retainedIndices: [50, 550],
    },
    100,
    100_000
  )
  expect(pages).toEqual([0, 5, 9, 10, 11, 12])
})

it("clamps preloading at collection boundaries and keeps the final partial page", () => {
  expect(
    viewportPageIndices(
      {
        startIndex: 0,
        endIndex: 34,
        prefetchRowCount: 140,
        retainedIndices: [],
      },
      100,
      3424
    )
  ).toEqual([0, 1])
  expect(
    viewportPageIndices(
      {
        startIndex: 3389,
        endIndex: 3423,
        prefetchRowCount: 140,
        retainedIndices: [-1, 5000],
      },
      100,
      3424
    )
  ).toEqual([0, 32, 33, 34])
  expect(
    viewportPageIndices(
      {
        startIndex: 0,
        endIndex: -1,
        prefetchRowCount: 80,
        retainedIndices: [],
      },
      100,
      0
    )
  ).toEqual([0])
})

const page = (length: number, more = true) => ({
  items: Array.from({ length }, (_, index) => index),
  totalSize: 1000,
  totalSizeExact: false,
  nextPageToken: more ? PageToken("next") : null,
})

it("grows beyond capped totals and remembers the terminal page after it leaves the viewport", () => {
  const first = page(100)
  const initial = viewportSize(first, [], 100, { rows: 0, complete: false })
  expect(initial).toEqual({ rows: 1100, complete: false })
  const grown = viewportSize(
    first,
    [{ offset: 1000, data: page(100) }],
    100,
    initial
  )
  expect(grown).toEqual({ rows: 1200, complete: false })
  expect(
    viewportPageIndices(
      {
        startIndex: 1090,
        endIndex: 1120,
        prefetchRowCount: 100,
        retainedIndices: [],
      },
      100,
      grown.rows
    )
  ).toContain(11)
  const terminal = viewportSize(
    first,
    [{ offset: 1100, data: page(23, false) }],
    100,
    grown
  )
  expect(terminal).toEqual({ rows: 1123, complete: true })
  expect(
    viewportSize(first, [{ offset: 0, data: first }], 100, terminal)
  ).toEqual(terminal)
  expect(
    viewportSize(first, [{ offset: 1100, data: page(100) }], 100, terminal)
  ).toEqual({ rows: 1300, complete: false })
  expect(
    viewportSize(
      { ...first, totalSize: 5, totalSizeExact: true },
      [],
      100,
      terminal
    )
  ).toEqual({ rows: 5, complete: true })
})
