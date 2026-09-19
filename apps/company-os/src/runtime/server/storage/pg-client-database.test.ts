import { PgClient } from "@effect/sql-pg"
import { it } from "@effect/vitest"
import { Deferred, Effect, Exit, Fiber, Redacted, Scope } from "effect"
import { Reactivity } from "effect/unstable/reactivity"
import { expect } from "vitest"

import { TestDatabase } from "#/runtime/server/storage/testing.ts"

it.live(
  "does not leak a pool connection when a queued reservation is interrupted",
  () =>
    Effect.gen(function* () {
      const template = yield* TestDatabase.createTemplate([])
      const database = yield* TestDatabase.clone(template)
      const sql = yield* PgClient.make({
        url: Redacted.make(database.url),
        maxConnections: 1,
        connectTimeout: "5 seconds",
      })
      const heldScope = yield* Effect.acquireRelease(Scope.make(), (scope) =>
        Scope.close(scope, Exit.void)
      )
      yield* Scope.provide(sql.reserve, heldScope)
      const started = yield* Deferred.make<void>()
      const waiter = yield* Effect.scoped(
        Deferred.succeed(started, undefined).pipe(Effect.andThen(sql.reserve))
      ).pipe(Effect.forkChild)
      yield* Deferred.await(started)
      yield* Effect.yieldNow
      expect(waiter.pollUnsafe()).toBeUndefined()
      yield* Fiber.interrupt(waiter).pipe(Effect.timeout("250 millis"))
      yield* Scope.close(heldScope, Exit.void)
      expect(
        yield* sql`select 1 as value`.pipe(Effect.timeout("2 seconds"))
      ).toEqual([{ value: 1 }])
    }).pipe(Effect.provide(Reactivity.layer))
)
