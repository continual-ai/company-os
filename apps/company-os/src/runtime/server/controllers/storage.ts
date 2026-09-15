import { Context, Effect, Layer } from "effect"

import {
  controllerConsumers,
  controllerInstances,
} from "#/runtime/server/storage/infrastructure.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

export class ControllerStorage extends Context.Service<ControllerStorage>()(
  "@company/ControllerStorage",
  {
    make: Effect.gen(function* () {
      const { sql } = yield* SqlDatabase
      return {
        cursor: Effect.fn("controllers.cursor")(function* (id: string) {
          const rows = yield* sql<{
            cursor: string
          }>`select cursor from ${controllerConsumers} where controller_id = ${id}`
          return rows[0]?.cursor
        }),
        saveCursor: (id: string, cursor: string) =>
          sql`
        insert into ${controllerConsumers} (controller_id, cursor) values (${id}, ${cursor})
        on conflict (controller_id) do update set cursor = excluded.cursor`.pipe(
            Effect.asVoid
          ),
        pending: (id: string, key: string) =>
          sql`
        insert into ${controllerInstances} (controller_id, key, state) values (${id}, ${key}, 'pending')
        on conflict (controller_id, key) do update set state = case when ${controllerInstances.columns.state} = 'running' then 'running' else 'pending' end`.pipe(
            Effect.asVoid
          ),
        timing: Effect.fn("controllers.timing")(function* (
          id: string,
          key: string,
          minInterval: number
        ) {
          const [row] = yield* sql<{
            waitMillis: number
            requeueAt: string | null
          }>`
            select greatest(0, ${minInterval} - extract(epoch from (clock_timestamp() - last_started_at)) * 1000)::float8 as "waitMillis",
              requeue_at as "requeueAt"
            from ${controllerInstances} where controller_id = ${id} and key = ${key}`
          return row ?? { waitMillis: 0, requeueAt: null }
        }),
        started: (id: string, key: string) =>
          sql`
        update ${controllerInstances} set state = 'running', last_started_at = clock_timestamp(), attempts = attempts + 1
        where controller_id = ${id} and key = ${key}`.pipe(Effect.asVoid),
        succeeded: (id: string, key: string, requeueAt: string | null = null) =>
          sql`
        update ${controllerInstances} set state = 'idle', last_succeeded_at = clock_timestamp(), last_error = null, requeue_at = ${requeueAt}
        where controller_id = ${id} and key = ${key}`.pipe(Effect.asVoid),
        failed: (id: string, key: string, error: string) =>
          sql`
        update ${controllerInstances} set state = 'error', last_error = ${error.slice(0, 8000)}
        where controller_id = ${id} and key = ${key}`.pipe(Effect.asVoid),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
