import { Effect } from "effect"
import { expect } from "vitest"

import { itDatabase } from "#/app/server/database/it-database.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { seedRuns } from "#/runtime/server/database/schema.ts"
import { insertValues } from "#/runtime/server/postgres/index.ts"
import {
  tableProjection,
  type TableRow,
} from "#/runtime/server/postgres/index.ts"

itDatabase(
  "releases nested savepoints while preserving rollback and sibling isolation",
  Effect.fn(function* () {
    const database = yield* Database
    const sql = database.sql
    yield* database.transaction((tx) =>
      Effect.forEach(
        ["one", "two", "three"],
        (name) =>
          tx.transaction((child) =>
            Effect.gen(function* () {
              yield* child.sql<
                Record<string, unknown>
              >`insert into ${seedRuns} ${insertValues(sql, seedRuns, { name, parameters: "{}" })}`
              const failed = yield* Effect.result(
                child.transaction((inner) =>
                  Effect.gen(function* () {
                    yield* inner.sql<
                      Record<string, unknown>
                    >`insert into ${seedRuns} ${insertValues(sql, seedRuns, { name: `${name}-failed`, parameters: "{}" })}`
                    return yield* Effect.fail(new Error("rollback child only"))
                  })
                )
              )
              expect(failed._tag).toBe("Failure")
            })
          ),
        { concurrency: 3 }
      ).pipe(
        Effect.tap(() =>
          Effect.gen(function* () {
            const locks = yield* sql`select count(*)::double precision as count
          from pg_locks

          where pid = pg_backend_pid() and locktype = 'transactionid'`
            expect(locks[0]!.count).toBe(1)
          })
        )
      )
    )
    expect(
      (yield* sql<TableRow<typeof seedRuns>>`select ${tableProjection(seedRuns)}
          from ${seedRuns}`)
        .map(({ name }) => name)
        .sort()
    ).toEqual(["one", "three", "two"])
    const failed = yield* Effect.result(
      database.transaction((tx) =>
        Effect.gen(function* () {
          yield* tx.transaction(
            (inner) =>
              inner.sql<
                Record<string, unknown>
              >`insert into ${seedRuns} ${insertValues(sql, seedRuns, { name: "rolled-back", parameters: "{}" })}`
          )
          return yield* Effect.fail(new Error("rollback outer"))
        })
      )
    )
    expect(failed._tag).toBe("Failure")
    expect(
      yield* sql<TableRow<typeof seedRuns>>`select ${tableProjection(seedRuns)}
          from ${seedRuns}`
    ).toHaveLength(3)
  })
)
