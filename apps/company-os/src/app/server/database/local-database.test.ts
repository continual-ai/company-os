import { randomUUID } from "node:crypto"

import { PgClient } from "@effect/sql-pg"
import { it } from "@effect/vitest"
import { Config, Effect } from "effect"
import { expect } from "vitest"

import { ensureLocalDatabase } from "#/app/server/database/local-database.ts"
import { testDatabaseClient } from "#/runtime/server/storage/testing.ts"

it.live(
  "creates a missing local database and preserves it on subsequent setup",
  () =>
    Effect.gen(function* () {
      const url = new URL(
        yield* Config.String("DATABASE_URL").pipe(
          Config.withDefault("postgresql://localhost:5433/postgres")
        )
      )
      url.pathname = `/company_os_test_database_${randomUUID().replaceAll("-", "").slice(0, 20)}`
      yield* ensureLocalDatabase(url.toString())
      yield* Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        yield* sql`create table local_setup_probe (value text)`
        yield* sql`insert into local_setup_probe values ('keep')`
        yield* ensureLocalDatabase(url.toString())
        expect(yield* sql`select value from local_setup_probe`).toEqual([
          { value: "keep" },
        ])
      }).pipe(Effect.provide(testDatabaseClient(url.toString())))
    })
)
