import { Effect } from "effect"
import { expect } from "vitest"

import {
  insertValues,
  tableProjection,
  type TableRow,
} from "#/runtime/server/storage/index.ts"
import { seedRuns } from "#/runtime/server/storage/infrastructure.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"
import { testDatabase } from "#/runtime/testing/database.ts"
import { kernelModel } from "#/runtime/testing/fixture-model.ts"

const fixture = testDatabase(kernelModel)

const names = (database: typeof SqlDatabase.Service) =>
  database.sql<TableRow<typeof seedRuns>>`select ${tableProjection(seedRuns)}
          from ${seedRuns}`.pipe(
    Effect.map((rows) => rows.map(({ name }) => name).sort())
  )

fixture.test("nested transaction calls join the enclosing transaction", () =>
  Effect.gen(function* () {
    const database = yield* SqlDatabase
    const sql = database.sql
    const insert = (name: string) =>
      sql`insert into ${seedRuns} ${insertValues(sql, seedRuns, { name, parameters: "{}" })}`
    yield* database.transaction((tx) =>
      Effect.gen(function* () {
        for (const name of ["one", "two"])
          yield* tx.transaction(() => insert(name))
        // Joining opens no savepoint: a nested failure leaves its writes to the enclosing decision.
        const failed = yield* Effect.result(
          tx.transaction(() =>
            insert("three").pipe(Effect.andThen(Effect.fail("nested failure")))
          )
        )
        expect(failed._tag).toBe("Failure")
        expect(yield* names(database)).toEqual(["one", "three", "two"])
        const locks = yield* sql`select count(*)::double precision as count
          from pg_locks
          where pid = pg_backend_pid() and locktype = 'transactionid'`
        expect(locks[0]!.count).toBe(1)
      })
    )
    expect(yield* names(database)).toEqual(["one", "three", "two"])
    const failed = yield* Effect.result(
      database.transaction((tx) =>
        tx
          .transaction(() => insert("rolled-back"))
          .pipe(Effect.andThen(Effect.fail("rollback outer")))
      )
    )
    expect(failed._tag).toBe("Failure")
    expect(yield* names(database)).toEqual(["one", "three", "two"])
  })
)

fixture.test("releases completed nested PostgreSQL savepoints", () =>
  Effect.gen(function* () {
    const { sql } = yield* SqlDatabase
    yield* sql`create temporary table savepoint_probe (value integer)`
    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`insert into savepoint_probe values (0)`
        const locks = () => sql<{
          count: number
        }>`select count(*)::integer as count
        from pg_locks where pid = pg_backend_pid() and locktype = 'transactionid'`
        const before = yield* locks()
        for (let value = 1; value <= 100; value++)
          yield* sql.withTransaction(
            sql`insert into savepoint_probe values (${value})`
          )
        expect(yield* locks()).toEqual(before)
        yield* sql
          .withTransaction(
            sql`insert into savepoint_probe values (-1)`.pipe(
              Effect.andThen(Effect.fail("rollback nested"))
            )
          )
          .pipe(Effect.result)
        expect(yield* locks()).toEqual(before)
        expect(
          yield* sql`select count(*)::integer as count from savepoint_probe`
        ).toEqual([{ count: 101 }])
      })
    )
  })
)
