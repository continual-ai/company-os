import { Schema } from "effect"
import { expect, it } from "vitest"

import { pageSchema, totalSizeFields } from "#/runtime/contract/pagination.ts"

it("requires explicit count accuracy and permits lower bounds independently of continuation", () => {
  const decode = Schema.decodeUnknownSync(pageSchema(Schema.String))
  for (const totalSizeExact of [true, false]) {
    for (const nextPageToken of [null, "next"]) {
      const page = {
        items: ["one"],
        totalSize: 10_000,
        totalSizeExact,
        nextPageToken,
      }
      expect(decode(page)).toEqual(page)
    }
  }
  expect(() =>
    decode({ items: [], totalSize: 0, nextPageToken: null })
  ).toThrow()
})

it("uses the same nonnegative integer count contract for link previews", () => {
  const decode = Schema.decodeUnknownSync(Schema.Struct(totalSizeFields))
  expect(decode({ totalSize: 0, totalSizeExact: true })).toEqual({
    totalSize: 0,
    totalSizeExact: true,
  })
  for (const totalSize of [-1, 1.5, Infinity]) {
    expect(() => decode({ totalSize, totalSizeExact: false })).toThrow()
  }
})
