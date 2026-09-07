import { sql } from "drizzle-orm"
import { Effect } from "effect"
import { expect } from "vitest"

import { Database } from "./database"
import { itDatabase } from "./it-database"
import { seedRuns } from "./schema"

itDatabase(
  "releases nested savepoints while preserving rollback and sibling isolation",
  Effect.fn(function* () {
    const database = yield* Database
    yield* database.transaction((tx) =>
      Effect.forEach(
        ["one", "two", "three"],
        (name) =>
          tx.transaction((child) =>
            Effect.gen(function* () {
              yield* child.insert(seedRuns).values({ name, parameters: "{}" })
              const failed = yield* Effect.result(
                child.transaction((inner) =>
                  Effect.gen(function* () {
                    yield* inner
                      .insert(seedRuns)
                      .values({ name: `${name}-failed`, parameters: "{}" })
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
            const locks = yield* tx.execute<{ count: number }>(
              sql`select count(*)::integer as count from pg_locks
              where pid = pg_backend_pid() and locktype = 'transactionid'`,
              "objects"
            )
            expect(locks[0]!.count).toBe(1)
          })
        )
      )
    )
    expect(
      (yield* database.select().from(seedRuns)).map(({ name }) => name).sort()
    ).toEqual(["one", "three", "two"])
    const failed = yield* Effect.result(
      database.transaction((tx) =>
        Effect.gen(function* () {
          yield* tx.transaction((inner) =>
            inner
              .insert(seedRuns)
              .values({ name: "rolled-back", parameters: "{}" })
          )
          return yield* Effect.fail(new Error("rollback outer"))
        })
      )
    )
    expect(failed._tag).toBe("Failure")
    expect(yield* database.select().from(seedRuns)).toHaveLength(3)
  })
)
