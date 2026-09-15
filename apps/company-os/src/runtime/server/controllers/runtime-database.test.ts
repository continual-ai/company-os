import { createServer } from "node:net"

import * as NodeClusterHttp from "@effect/platform-node/NodeClusterHttp"
import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { it } from "@effect/vitest"
import {
  Clock,
  Context,
  Deferred,
  Effect,
  Layer,
  Schedule,
  Option,
  Scope,
  Exit,
} from "effect"
import { SingleRunner, RunnerAddress } from "effect/unstable/cluster"
import { SqlClient } from "effect/unstable/sql"
import { expect } from "vitest"

import {
  defineController,
  defineModel,
  defineModule,
  defineObject,
  RecordId,
  schema,
} from "#/runtime/model/index.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"
import {
  ModuleSetting,
  PlatformModule,
} from "#/runtime/platform/model/index.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { reconcileController } from "#/runtime/platform/server/reconcile-controller.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import {
  defineControllerServer,
  type ControllerServer,
} from "#/runtime/server/controllers/definition.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"
import { ControllerStorage } from "#/runtime/server/controllers/storage.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Item = defineObject({
  id: "workItem",
  collection: "workItems",
  name: "Work item",
  pluralName: "Work items",
  properties: {
    title: schema.string(),
    done: schema.boolean({ default: false }),
  },
  display: { title: "title" },
})
const Delivery = defineController({ id: "delivery", object: Item })
const Ranking = defineController({ id: "ranking", collection: Item })
const Module = defineModule({
  id: "work",
  name: "Work",
  objects: [Item],
  controllers: [Delivery, Ranking],
})
const Model = defineModel({
  name: "Controller test",
  modules: [PlatformModule, Module],
})
const fixture = testFoundation(Model)
const liveClock = Context.get(Context.empty(), Clock.Clock)

const eventually = <E, R>(check: Effect.Effect<boolean, E, R>) =>
  check.pipe(
    Effect.repeat({ until: Boolean, schedule: Schedule.spaced("20 millis") }),
    Effect.timeout("20 seconds")
  )

// Keep the fixture's existing pool alive across host restarts; only the cluster scope is replaced.
const host = <R>(servers: ReadonlyArray<ControllerServer<R>>) =>
  Effect.gen(function* () {
    const database = yield* Database
    const cluster = SingleRunner.layer({
      runnerStorage: "memory",
      shardingConfig: {
        entityMessagePollInterval: "20 millis",
        refreshAssignmentsInterval: "20 millis",
        entityTerminationTimeout: "20 millis",
        entityMaxIdleTime: "1 minute",
      },
    }).pipe(
      Layer.provide(NodeCrypto.layer),
      Layer.provide(Layer.succeed(SqlClient.SqlClient, database.sql))
    )
    return Layer.mergeAll(
      Layer.empty,
      ...servers.map((server) => controllerLayer(Model, server))
    ).pipe(
      Layer.provide(cluster),
      Layer.provide(EventNotifications.layerPolling)
    )
  })

fixture.test(
  "serializes each key, coalesces wakeups during a run, retries failures, and lets other keys progress",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const journal = yield* EventJournal
      const storage = yield* ControllerStorage
      const first = yield* database.repository(Item).create({ title: "First" })
      const release = yield* Deferred.make<void>()
      const entered = yield* Deferred.make<void>()
      let active = 0
      let maximum = 0
      let runs = 0
      const server = defineControllerServer(Delivery, {
        reconcile: (key) =>
          Effect.gen(function* () {
            if (key === first.id) {
              active++
              maximum = Math.max(maximum, active)
              runs++
              yield* Effect.gen(function* () {
                if (runs === 1) {
                  yield* Deferred.succeed(entered, undefined)
                  yield* Deferred.await(release)
                  return yield* Effect.fail(new Error("temporary failure"))
                }
                return undefined
              }).pipe(
                Effect.ensuring(
                  Effect.sync(() => {
                    active--
                  })
                )
              )
            }
            const id = RecordId(Item.id)(key)
            const item = yield* database.repository(Item).get({ id })
            if (!item.done)
              yield* database.repository(Item).update({ id, done: true })
          }),
      })
      const layer = yield* host([server])
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(layer)
          yield* Deferred.await(entered)
          const second = yield* database
            .repository(Item)
            .create({ title: "Second" })
          for (let i = 0; i < 15; i++)
            yield* database
              .repository(Item)
              .update({ id: first.id, title: `First ${i}` })
          yield* eventually(
            database
              .repository(Item)
              .get({ id: second.id })
              .pipe(Effect.map((item) => item.done))
          ).pipe(
            Effect.mapError(() => new Error("second key did not progress"))
          )
          yield* eventually(
            storage
              .cursor(Delivery.id)
              .pipe(
                Effect.flatMap((cursor) =>
                  cursor
                    ? journal
                        .list({ cursor })
                        .pipe(Effect.map((page) => page.items.length === 0))
                    : Effect.succeed(false)
                )
              )
          ).pipe(
            Effect.mapError(() => new Error("event reader did not catch up"))
          )
          yield* eventually(
            database
              .repository(Item)
              .get({ id: second.id })
              .pipe(Effect.map((item) => item.done))
          ).pipe(
            Effect.mapError(() => new Error("second key did not progress"))
          )
          expect(runs).toBe(1)
          yield* Deferred.succeed(release, undefined)
          yield* eventually(
            database
              .repository(Item)
              .get({ id: first.id })
              .pipe(Effect.map((item) => item.done))
          )
          yield* eventually(Effect.sync(() => runs >= 3))
          expect(maximum).toBe(1)
          expect(runs).toBeLessThan(10)
        })
      )
    }).pipe(
      Effect.provide(ControllerStorage.layer),
      Effect.provideService(Clock.Clock, liveClock)
    )
)

fixture.test(
  "recovers unacknowledged work and events written while the host is stopped; collection scope uses one key",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const first = yield* database
        .repository(Item)
        .create({ title: "Before restart" })
      const entered = yield* Deferred.make<void>()
      const blocked = defineControllerServer(Delivery, {
        reconcile: () =>
          Deferred.succeed(entered, undefined).pipe(
            Effect.andThen(Effect.never)
          ),
      })
      const firstHost = yield* host([blocked])
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(firstHost)
          yield* Deferred.await(entered)
        })
      )
      const pending = yield* database.sql<{
        id: string
      }>`select id from cluster_messages where entity_type = 'controller/delivery' and processed = false`
      expect(pending.length).toBeGreaterThan(0)
      const second = yield* database
        .repository(Item)
        .create({ title: "While stopped" })
      const completed = new Set<string>()
      let rankings = 0
      const nextHost = yield* host([
        defineControllerServer(Delivery, {
          reconcile: (key) =>
            Effect.sync(() => {
              completed.add(key)
            }),
        }),
        defineControllerServer(Ranking, {
          reconcile: () =>
            Effect.sync(() => {
              rankings++
            }),
        }),
      ])
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(nextHost)
          yield* eventually(
            Effect.sync(
              () =>
                completed.has(first.id) &&
                completed.has(second.id) &&
                rankings > 0
            )
          )
          yield* eventually(
            database.sql<{
              remaining: number
            }>`select count(*)::int as remaining from cluster_messages where id in ${database.sql.in(pending.map((message) => message.id))} and processed = false`.pipe(
              Effect.map((rows) => rows[0]!.remaining === 0)
            )
          )
          // Explicitly rescan object keys and wake the collection key through durable requests.
          completed.clear()
          const rankingsBefore = rankings
          yield* database.transaction(() =>
            reconcileController({ id: controllerAlias(Delivery.id) })
          )
          yield* database.transaction(() =>
            reconcileController({ id: controllerAlias(Ranking.id) })
          )
          yield* eventually(
            Effect.sync(
              () =>
                completed.has(first.id) &&
                completed.has(second.id) &&
                rankings > rankingsBefore
            )
          )
          expect(
            yield* database
              .transaction(() =>
                reconcileController({
                  id: controllerAlias(Ranking.id),
                  key: first.id,
                })
              )
              .pipe(Effect.flip)
          ).toMatchObject({ status: "FAILED_PRECONDITION" })
          const rows = yield* database.sql<{
            key: string
          }>`select key from controller_instances where controller_id = ${Ranking.id}`
          expect(rows.map((row) => row.key)).toEqual(["collection"])
        })
      )
    }).pipe(Effect.provideService(Clock.Clock, liveClock))
)

fixture.test(
  "scans only on first registration and resumes the cursor on restart and reactivation",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const storage = yield* ControllerStorage
      const journal = yield* EventJournal
      const runs = new Map<string, number>()
      const server = defineControllerServer(Delivery, {
        reconcile: (key) =>
          Effect.sync(() => {
            runs.set(key, (runs.get(key) ?? 0) + 1)
          }),
      })
      const settled = eventually(
        Effect.gen(function* () {
          const cursor = yield* storage.cursor(Delivery.id)
          if (!cursor) return false
          const page = yield* journal.list({ cursor })
          const [messages] = yield* database.sql<{
            pending: number
          }>`select count(*)::int as pending from cluster_messages where entity_type = 'controller/delivery' and processed = false`
          return (
            !page.hasMore && page.items.length === 0 && messages!.pending === 0
          )
        })
      )
      const initial = yield* database
        .repository(Item)
        .create({ title: "Existing before registration" })
      const firstHost = yield* host([server])
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(firstHost)
          yield* eventually(Effect.sync(() => runs.has(initial.id)))
          yield* settled
        })
      )
      expect(runs.get(initial.id)).toBe(1)

      const missed = yield* database
        .repository(Item)
        .create({ title: "Created while stopped" })
      const restartedHost = yield* host([server])
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(restartedHost)
          yield* eventually(Effect.sync(() => runs.has(missed.id)))
          yield* settled
          expect(runs.get(initial.id)).toBe(1)

          const setting = moduleAlias("work")
          yield* database
            .repository(ModuleSetting)
            .update({ id: setting, enabled: false })
          yield* Effect.sleep("1200 millis")
          const paused = yield* database
            .repository(Item)
            .create({ title: "Created while disabled" })
          yield* Effect.sleep("1200 millis")
          expect(runs.has(paused.id)).toBe(false)
          yield* database
            .repository(ModuleSetting)
            .update({ id: setting, enabled: true })
          yield* eventually(Effect.sync(() => runs.has(paused.id)))
          yield* settled
          expect(runs.get(initial.id)).toBe(1)
          expect(runs.get(missed.id)).toBe(1)

          yield* database.transaction(() =>
            reconcileController({ id: controllerAlias(Delivery.id) })
          )
          yield* eventually(
            Effect.sync(
              () =>
                runs.get(initial.id) === 2 &&
                runs.get(missed.id) === 2 &&
                runs.get(paused.id) === 2
            )
          )
          yield* settled
        })
      )
    }).pipe(
      Effect.provide(ControllerStorage.layer),
      Effect.provideService(Clock.Clock, liveClock)
    )
)

const availablePort = Effect.promise(
  () =>
    new Promise<number>((resolve, reject) => {
      const listener = createServer()
      listener.on("error", reject)
      listener.listen(0, "127.0.0.1", () => {
        const address = listener.address()
        if (!address || typeof address === "string")
          return reject(new Error("Missing listen address"))
        listener.close((error) =>
          error ? reject(error) : resolve(address.port)
        )
      })
    })
)

// Native HTTP servers and SQL runner locks must finalize under the live clock too.
it.live(
  "coordinates two HTTP runners through PostgreSQL and continues after one runner stops",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const item = yield* database.repository(Item).create({ title: "Shared" })
      let active = 0
      let maximum = 0
      const completed = new Map<number, number>()
      const node = (port: number) =>
        controllerLayer(
          Model,
          defineControllerServer(Delivery, {
            reconcile: () =>
              Effect.gen(function* () {
                active++
                maximum = Math.max(maximum, active)
                yield* Effect.sleep("80 millis").pipe(
                  Effect.ensuring(
                    Effect.sync(() => {
                      active--
                    })
                  )
                )
                completed.set(port, (completed.get(port) ?? 0) + 1)
              }),
          })
        ).pipe(
          Layer.provide(
            NodeClusterHttp.layer({
              transport: "http",
              storage: "sql",
              shardingConfig: {
                runnerAddress: Option.some(
                  RunnerAddress.make("127.0.0.1", port)
                ),
                runnerListenAddress: Option.some(
                  RunnerAddress.make("127.0.0.1", port)
                ),
                shardsPerGroup: 1,
                refreshAssignmentsInterval: "50 millis",
                entityMessagePollInterval: "20 millis",
                entityTerminationTimeout: "100 millis",
                shardLockRefreshInterval: "100 millis",
              },
            }).pipe(
              Layer.provide(Layer.succeed(SqlClient.SqlClient, database.sql))
            )
          ),
          Layer.provide(EventNotifications.layerPolling)
        )
      const firstPort = yield* availablePort
      const secondPort = yield* availablePort
      const secondScope = yield* Scope.make()
      yield* Effect.addFinalizer(() =>
        Scope.close(secondScope, Exit.succeed(undefined)).pipe(
          Effect.provideService(Clock.Clock, liveClock)
        )
      )
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(node(firstPort))
          yield* eventually(
            Effect.sync(() => (completed.get(firstPort) ?? 0) > 0)
          )
          yield* Layer.build(node(secondPort)).pipe(
            Effect.provideService(Scope.Scope, secondScope)
          )
          for (let i = 0; i < 10; i++) {
            yield* database
              .repository(Item)
              .update({ id: item.id, title: `Shared ${i}` })
            yield* Effect.sleep("30 millis")
          }
        })
      )
      const before = completed.get(secondPort) ?? 0
      yield* database
        .repository(Item)
        .update({ id: item.id, title: "After handoff" })
      yield* eventually(
        Effect.sync(() => (completed.get(secondPort) ?? 0) > before)
      )
      expect(maximum).toBe(1)
    }).pipe(
      Effect.scoped,
      Effect.provide(fixture.layer),
      Effect.provideService(CurrentInvocation, systemInvocation)
    ),
  60_000
)
