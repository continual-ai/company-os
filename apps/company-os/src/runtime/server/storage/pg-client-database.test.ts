import { PgClient } from "@effect/sql-pg"
import { it } from "@effect/vitest"
import { Effect, Exit, Fiber, Schedule, Scope } from "effect"
import { Reactivity } from "effect/unstable/reactivity"
import { Pool } from "pg"
import { expect } from "vitest"

import { TestDatabase } from "#/runtime/server/storage/testing.ts"

it.live(
  "does not leak a pool connection when a queued reservation is interrupted",
  () =>
    Effect.gen(function* () {
      const template = yield* Effect.promise(() =>
        TestDatabase.createTemplate("")
      )
      const database = yield* Effect.promise(() => TestDatabase.clone(template))
      const pool = new Pool({
        connectionString: database.url,
        max: 1,
        connectionTimeoutMillis: 5000,
      })
      const sql = yield* PgClient.fromPool({
        acquire: Effect.acquireRelease(Effect.succeed(pool), (client) =>
          Effect.promise(() => client.end()).pipe(
            Effect.timeoutOption("1 second")
          )
        ),
      })
      const heldScope = yield* Effect.acquireRelease(Scope.make(), (scope) =>
        Scope.close(scope, Exit.void)
      )
      yield* Scope.provide(sql.reserve, heldScope)
      const waiter = yield* Effect.scoped(sql.reserve).pipe(Effect.forkChild)
      yield* Effect.sync(() => pool.waitingCount).pipe(
        Effect.repeat({
          until: (count) => count === 1,
          schedule: Schedule.spaced("1 millis"),
        }),
        Effect.timeout("2 seconds")
      )
      yield* Fiber.interrupt(waiter).pipe(Effect.timeout("250 millis"))
      expect(pool.waitingCount).toBe(1)
      yield* Scope.close(heldScope, Exit.void)
      expect(yield* sql`select 1 as value`).toEqual([{ value: 1 }])
      expect(pool.idleCount).toBe(1)
    }).pipe(Effect.provide(Reactivity.layer))
)
