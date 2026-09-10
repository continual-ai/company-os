import { Effect } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { applyMigrations } from "#/app/server/database/migrations.ts"
import { resetDevelopmentSchema } from "#/app/server/database/reset.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { testDatabase } from "#/runtime/testing/database.ts"

const fixture = testDatabase(Model)

fixture.test(
  "rebuilds disposable storage from the model without pretending to replay migrations",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* Database
      yield* sql`create table discarded_local_data (id integer)`
      yield* sql`insert into discarded_local_data values (1)`
      yield* resetDevelopmentSchema("public")
      expect(
        yield* sql`select to_regclass('discarded_local_data') as old, to_regclass('company_os_migrations') as ledger`
      ).toEqual([{ old: null, ledger: null }])
      expect(yield* sql`select id from event_journal_state`).toEqual([
        { id: 1 },
      ])
      expect(
        (yield* sql`select id from service_accounts`).length
      ).toBeGreaterThan(0)
      expect((yield* sql`select id from search_index_state`).length).toBe(1)
      yield* Effect.flip(applyMigrations())
      expect(
        yield* sql`select to_regclass('company_os_migrations') as ledger`
      ).toEqual([{ ledger: null }])
    })
)
