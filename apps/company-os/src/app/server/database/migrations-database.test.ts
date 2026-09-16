import { PgClient } from "@effect/sql-pg"
import { Effect, Exit, Redacted } from "effect"
import { expect, it } from "vitest"

import { Model } from "#/app.model.ts"
import {
  migrateDatabaseSchema,
  migrations,
} from "#/app/server/database/migrations.ts"
import { resetDevelopmentSchema } from "#/app/server/database/reset.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { ApplicationKeys } from "#/runtime/server/application-keys.ts"
import { foundationLayer } from "#/runtime/server/foundation.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { pgTypes } from "#/runtime/server/storage/index.ts"
import { TestDatabase } from "#/runtime/server/storage/testing.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { readSchemaCatalog } from "#/runtime/testing/schema-catalog.ts"

const initialized = testDatabase(
  Model,
  async (url) => {
    await Effect.runPromise(
      Effect.scoped(
        migrateDatabaseSchema("public").pipe(
          Effect.provide(
            foundationLayer(Model, {
              sql: PgClient.layer({ url: Redacted.make(url), types: pgTypes }),
              pageTokens: PageTokens.layerTest,
              applicationKeys: ApplicationKeys.layerTest,
            })
          )
        )
      )
    )
  },
  `migrations:${schemaSql}`
)
const empty = testDatabase(Model, "")

initialized.test("keeps data and records the initial migration only once", () =>
  Effect.gen(function* () {
    const { sql } = yield* SqlDatabase
    yield* sql`create table retained_probe (value text)`
    yield* sql`insert into retained_probe values ('keep me')`
    yield* migrateDatabaseSchema("public")
    yield* migrateDatabaseSchema("public")
    const expected = yield* migrations
    expect(
      yield* sql`select migration_id as id, name from company_os_migrations`
    ).toEqual(expected.map(([id, name]) => ({ id, name })))
    expect(yield* sql`select value from retained_probe`).toEqual([
      { value: "keep me" },
    ])
  })
)

initialized.test(
  "rejects a changed pre-release baseline and reset reapplies only migration one",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* SqlDatabase
      yield* sql`create table baseline_probe (value text)`
      yield* sql`insert into baseline_probe values ('keep until reset')`
      yield* sql`update company_os_migrations set name = 'initial_outdated'`
      expect(
        Exit.isFailure(yield* migrateDatabaseSchema("public").pipe(Effect.exit))
      ).toBe(true)
      expect(yield* sql`select value from baseline_probe`).toEqual([
        { value: "keep until reset" },
      ])
      yield* resetDevelopmentSchema("public")
      const expected = yield* migrations
      expect(
        yield* sql`select migration_id as id, name from company_os_migrations`
      ).toEqual(expected.map(([id, name]) => ({ id, name })))
      expect(
        yield* sql`select to_regclass('baseline_probe') as discarded`
      ).toEqual([{ discarded: null }])
    })
)

it("initializes exactly the current model structure, including functions, triggers, and indexes", async () => {
  const declared = await TestDatabase.createTemplate(schemaSql)
  const [actual, expected] = await Promise.all([
    readSchemaCatalog(TestDatabase.url(await initialized.template()), {
      exclude: ["company_os_migrations"],
    }),
    readSchemaCatalog(TestDatabase.url(declared)),
  ])
  expect(actual.tables.length).toBeGreaterThan(10)
  expect(actual).toEqual(expected)
})

empty.test("refuses an occupied schema without changing its contents", () =>
  Effect.gen(function* () {
    const { sql } = yield* SqlDatabase
    yield* sql`create table retained_probe (value text)`
    yield* sql`insert into retained_probe values ('keep me')`
    expect(
      Exit.isFailure(yield* migrateDatabaseSchema("public").pipe(Effect.exit))
    ).toBe(true)
    expect(yield* sql`select value from retained_probe`).toEqual([
      { value: "keep me" },
    ])
    expect(yield* sql`select to_regclass('objects') as registry`).toEqual([
      { registry: null },
    ])
  })
)

empty.test(
  "initializes a named schema without touching public, and does not apply setup twice",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* SqlDatabase
      yield* sql`create table untouched (value text)`
      yield* sql`insert into untouched values ('keep me')`
      yield* migrateDatabaseSchema("company")
      expect(yield* sql`select id from company.event_journal_state`).toEqual([
        { id: 1 },
      ])
      expect(
        (yield* sql`select id from company.service_accounts`).length
      ).toBeGreaterThan(0)
      expect(
        (yield* sql`select id from company.search_index_state`).length
      ).toBe(1)
      yield* migrateDatabaseSchema("company")
      expect(
        yield* sql`select migration_id from company.company_os_migrations`
      ).toEqual([{ migration_id: 1 }])
      yield* resetDevelopmentSchema("company")
      expect(yield* sql`select value from untouched`).toEqual([
        { value: "keep me" },
      ])
      expect(yield* sql`select to_regclass('objects') as registry`).toEqual([
        { registry: null },
      ])
    })
)

empty.test(
  "rolls back all initialization when its enclosing transaction fails",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* SqlDatabase
      const result = yield* sql
        .withTransaction(
          Effect.gen(function* () {
            yield* migrateDatabaseSchema("rollback_probe")
            return yield* Effect.fail(new Error("Abort initialization"))
          })
        )
        .pipe(Effect.exit)
      expect(Exit.isFailure(result)).toBe(true)
      expect(
        yield* sql`select to_regnamespace('rollback_probe') as schema`
      ).toEqual([{ schema: null }])
    })
)
