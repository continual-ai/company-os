import { PgTypes } from "@effect/sql-pg"
import { Result } from "effect"
import { expect, it } from "vitest"

import { pgTypes } from "#/runtime/server/storage/pg-types.ts"

const parse = (micros: bigint) => {
  const bytes = new Uint8Array(8)
  new DataView(bytes.buffer).setBigInt64(0, micros)
  return Result.getOrThrow(
    PgTypes.decode(bytes, PgTypes.OID.timestamptz, 1, pgTypes)
  )
}

it("retains timestamp microseconds on both sides of the PostgreSQL epoch", () => {
  const base =
    BigInt(
      Date.parse("2026-09-12T17:00:00Z") - Date.parse("2000-01-01T00:00:00Z")
    ) * 1000n
  expect(parse(base + 123456n)).toBe("2026-09-12T17:00:00.123456Z")
  expect(parse(base + 100000n)).toBe("2026-09-12T17:00:00.100Z")
  expect(parse(-1n)).toBe("1999-12-31T23:59:59.999999Z")
})

it("keeps timestamp arrays on the same codec and preserves null elements", () => {
  const bytes = Result.getOrThrow(
    PgTypes.encode(
      [new Date("2026-09-12T17:00:00Z"), null],
      PgTypes.OID.timestamptzArray
    )
  )
  expect(
    Result.getOrThrow(
      PgTypes.decode(bytes, PgTypes.OID.timestamptzArray, 1, pgTypes)
    )
  ).toEqual(["2026-09-12T17:00:00.000Z", null])
})

it("decodes regclass catalog identifiers as unsigned OIDs", () => {
  const bytes = Result.getOrThrow(PgTypes.encode(4294967294, PgTypes.OID.oid))
  expect(Result.getOrThrow(PgTypes.decode(bytes, 2205, 1, pgTypes))).toBe(
    4294967294
  )
})
