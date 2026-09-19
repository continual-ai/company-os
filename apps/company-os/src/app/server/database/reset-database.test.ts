import { Effect } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { resetDevelopmentSchema } from "#/app/server/database/reset.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import { testDatabase } from "#/runtime/testing/database.ts"

const fixture = testDatabase(Model)

fixture.test(
  "rebuilds disposable storage from the model by reapplying migration one with system records and search",
  () =>
    Effect.gen(function* () {
      const { sql } = yield* SqlDatabase
      yield* sql`create table discarded_local_data (id integer)`
      yield* sql`insert into discarded_local_data values (1)`
      yield* resetDevelopmentSchema("public")
      expect(
        yield* sql`select to_regclass('discarded_local_data')::text as old`
      ).toEqual([{ old: null }])
      expect(
        yield* sql`select migration_id from company_os_migrations`
      ).toEqual([{ migration_id: 1 }])
      expect(yield* sql`select id from event_journal_state`).toEqual([
        { id: 1 },
      ])
      expect(
        (yield* sql`select id from service_accounts`).length
      ).toBeGreaterThan(0)
      expect((yield* sql`select id from search_index_state`).length).toBe(1)
    })
)
