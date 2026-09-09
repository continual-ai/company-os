import { expect, it } from "vitest"

import { readMigrationFile } from "#/app/server/database/migration-file.ts"

it("reads plain SQL without changing whitespace or splitting function bodies", () => {
  const sql =
    "\ncreate function example() returns void language plpgsql as $$\nbegin\n  perform 1;\nend;\n$$;\n"
  expect(readMigrationFile("0003-example.sql", sql)).toEqual({
    id: 3,
    name: "example",
    sql,
  })
})

it("rejects malformed migration names and empty files", () => {
  expect(() => readMigrationFile("example.sql", "select 1;")).toThrow(
    "filename"
  )
  expect(() => readMigrationFile("0003-example.sql", "\n")).toThrow("no SQL")
})
