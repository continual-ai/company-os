import { Context, Effect, Layer } from "effect"

import {
  type ObjectRecord,
  type ObjectUpdateInput,
  RecordId,
  Timestamp,
} from "#/runtime/model/index.ts"
import {
  ControllerInstance,
  controllerInstanceAlias,
} from "#/runtime/platform/model/controller-instance.ts"
import {
  Controller,
  controllerAlias,
} from "#/runtime/platform/model/controller.ts"
import type { AgentSessionReference } from "#/runtime/server/agent.ts"
import { Database } from "#/runtime/server/database.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { controllerConsumers } from "#/runtime/server/storage/infrastructure.ts"

type Instance = ObjectRecord<typeof ControllerInstance>

export class ControllerStorage extends Context.Service<ControllerStorage>()(
  "@company/ControllerStorage",
  {
    make: Effect.gen(function* () {
      const database = yield* Database
      const invocation = yield* CurrentInvocation
      const { sql } = database
      const instances = database.repository(ControllerInstance)
      const table = database.table(ControllerInstance)
      const get = (id: string, key: string) =>
        instances.get({ id: controllerInstanceAlias(id, key) }).pipe(
          Effect.catchTags({
            ObjectNotFound: () => Effect.succeed(undefined),
            RecordAliasNotFound: () => Effect.succeed(undefined),
          })
        )
      // Serialize repository read/modify/write across hosts, including the initial creation.
      const locked = <A, E, R>(
        id: string,
        key: string,
        body: Effect.Effect<A, E, R>
      ) =>
        database
          .transaction(() =>
            sql`select pg_advisory_xact_lock(hashtextextended(${controllerInstanceAlias(id, key)}, 0))`.pipe(
              Effect.andThen(body)
            )
          )
          .pipe(Effect.provideService(CurrentInvocation, invocation))
      const update = (
        id: string,
        key: string,
        values: (
          instance: Instance,
          now: string
        ) => Omit<ObjectUpdateInput<typeof ControllerInstance>, "id">
      ) =>
        locked(
          id,
          key,
          Effect.gen(function* () {
            const instance = yield* get(id, key)
            if (!instance) return false
            const [clock] = yield* sql<{
              now: string
            }>`select clock_timestamp() as now`
            yield* instances.update(
              { id: instance.id, ...values(instance, clock!.now) },
              true
            )
            return true
          })
        ).pipe(Effect.catchTag("ObjectNotFound", () => Effect.succeed(false)))
      return {
        get,
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
          locked(
            id,
            key,
            Effect.gen(function* () {
              const current = yield* get(id, key)
              if (current) {
                if (current.state !== "running")
                  yield* instances.update(
                    { id: current.id, state: "pending" },
                    true
                  )
                return true
              }
              const controller = yield* database
                .repository(Controller)
                .get({ id: controllerAlias(id) })
              yield* instances.create({
                aliases: [controllerInstanceAlias(id, key)],
                links: {
                  controller: controller.id,
                  record:
                    controller.scope === "record"
                      ? RecordId(controller.targetObjectType)(key)
                      : null,
                },
              })
              return true
            })
          ).pipe(
            Effect.catchTag("ObjectNotFound", () => Effect.succeed(false))
          ),
        timing: Effect.fn("controllers.timing")(function* (
          id: string,
          key: string,
          minInterval: number
        ) {
          const instance = yield* get(id, key)
          if (!instance) return undefined
          const [row] = yield* sql<{
            waitMillis: number
            requeueAt: string | null
          }>`
            select greatest(0, ${minInterval} - extract(epoch from (clock_timestamp() - last_started_at)) * 1000)::float8 as "waitMillis",
              requeue_at as "requeueAt" from ${table} where id = ${instance.id}`
          return row
        }),
        started: (id: string, key: string) =>
          update(id, key, (instance, now) => ({
            state: "running",
            lastStartedAt: Timestamp(now),
            runs: instance.runs + 1,
          })),
        succeeded: (id: string, key: string, requeueAt: string | null = null) =>
          update(id, key, (_, now) => ({
            state: "idle",
            lastSucceededAt: Timestamp(now),
            lastError: null,
            requeueAt: requeueAt === null ? null : Timestamp(requeueAt),
          })),
        failed: (id: string, key: string, error: string) =>
          update(id, key, (instance) => ({
            failures:
              instance.failures + (instance.state === "running" ? 1 : 0),
            state: "error",
            lastError: error.slice(0, 8000),
          })),
        saveSession: (
          id: string,
          key: string,
          session: AgentSessionReference
        ) =>
          update(id, key, () => ({
            agentSessionId: session.id,
            agentSessionUrl: session.url,
          })).pipe(Effect.asVoid),
      }
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
}
