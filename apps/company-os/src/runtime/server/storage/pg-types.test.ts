import { expect, it } from "vitest"

import { pgTypes } from "#/runtime/server/storage/pg-types.ts"

it("retains timestamp precision so returned values round-trip through equality filters", () => {
  const parse = pgTypes.getTypeParser(1184, "text")
  expect(parse("2026-09-12 10:00:00.123456-07")).toBe(
    "2026-09-12T17:00:00.123456Z"
  )
  expect(parse("2026-09-12 17:00:00.1+00")).toBe("2026-09-12T17:00:00.100Z")
})
