import { expect, it } from "vitest"

import { viewportPageIndices } from "#/runtime/ui/model/use-viewport-pages.ts"

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
