import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { Clock, Context, Deferred, Effect, Layer, Schedule } from "effect"
import { SingleRunner } from "effect/unstable/cluster"
import { SqlClient } from "effect/unstable/sql"
import { expect } from "vitest"

import {
  defineController,
  defineModel,
  defineModule,
  defineObject,
  schema,
} from "#/runtime/model/index.ts"
import { ControllerTarget } from "#/runtime/platform/model/controller-instance.ts"
import {
  Controller,
  controllerAlias,
} from "#/runtime/platform/model/controller.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { controllerStatus } from "#/runtime/platform/server/controller-status.ts"
import { reconcileController } from "#/runtime/platform/server/reconcile-controller.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import {
  defineControllerServer,
  type ControllerServer,
} from "#/runtime/server/controllers/definition.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Item = defineObject({
  id: "timedItem",
  collection: "timedItems",
  name: "Timed item",
  pluralName: "Timed items",
  implements: [{ interface: ControllerTarget }],
  properties: { title: schema.string() },
  display: { title: "title" },
})
const Periodic = defineController({
  id: "periodic",
  record: Item,
  schedule: { cron: "* * * * * *" },
  minInterval: "200 millis",
})
const Collection = defineController({
  id: "collection-timer",
  object: Item,
  schedule: { cron: "* * * * * *" },
})
const Delayed = defineController({
  id: "delayed",
  record: Item,
  minInterval: "800 millis",
})
const Model = defineModel({
  name: "Timing test",
  modules: [
    PlatformModule,
    defineModule({
      id: "timing",
      name: "Timing",
      objects: [Item],
      controllers: [Periodic, Collection, Delayed],
    }),
  ],
})
const fixture = testFoundation(Model)
const liveClock = Context.get(Context.empty(), Clock.Clock)
const eventually = <E, R>(effect: Effect.Effect<boolean, E, R>) =>
  effect.pipe(
    Effect.repeat({ until: Boolean, schedule: Schedule.spaced("20 millis") }),
    Effect.timeout("15 seconds")
  )
const host = <R>(servers: ReadonlyArray<ControllerServer<R>>) =>
  Effect.gen(function* () {
    const database = yield* Database
    const cluster = SingleRunner.layer({
      runnerStorage: "memory",
      shardingConfig: {
        entityMessagePollInterval: "20 millis",
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
  "cron and watches share keyed execution; throttling also covers retries",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const items = (yield* Database).repository(Item)
      const first = yield* items.create({ title: "First" })
      const second = yield* items.create({ title: "Second" })
      const starts = new Map<string, number[]>()
      let collectionRuns = 0
      let fail = true
      const layer = yield* host([
        defineControllerServer(Periodic, {
          reconcile: Effect.fn(function* (key) {
            const times = starts.get(key) ?? []
            times.push(
              Date.parse(
                (yield* controllerStatus({
                  id: controllerAlias(Periodic.id),
                  key,
                })).lastStartedAt!
              )
            )
            starts.set(key, times)
            if (key === first.id && fail) {
              fail = false
              return yield* Effect.fail("Retry me")
            }
            return undefined
          }),
        }),
        defineControllerServer(Collection, {
          reconcile: () =>
            Effect.sync(() => {
              collectionRuns++
            }),
        }),
      ])
      yield* Layer.build(layer)
      yield* eventually(
        Effect.sync(
          () =>
            (starts.get(first.id)?.length ?? 0) >= 2 &&
            (starts.get(second.id)?.length ?? 0) >= 2 &&
            collectionRuns >= 2
        )
      )
      // Updates arrive while a key is cooling down; none bypass the throttle.
      for (let i = 0; i < 6; i++)
        yield* items.update({ id: first.id, title: `Revision ${i}` })
      const before = starts.get(first.id)!.length
      yield* eventually(
        Effect.sync(() => starts.get(first.id)!.length > before)
      )
      for (const times of starts.values())
        for (let i = 1; i < times.length; i++)
          expect(times[i]! - times[i - 1]!).toBeGreaterThanOrEqual(195)
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)

fixture.test(
  "delayed requeues and per-key throttles survive a worker restart",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const item = yield* (yield* Database)
        .repository(Item)
        .create({ title: "Durable follow-up" })
      const starts: number[] = []
      const server = defineControllerServer(Delayed, {
        reconcile: () =>
          Effect.gen(function* () {
            starts.push(
              Date.parse(
                (yield* controllerStatus({
                  id: controllerAlias(Delayed.id),
                  key: item.id,
                })).lastStartedAt!
              )
            )
            return starts.length === 1
              ? { requeueAfter: "400 millis" as const }
              : undefined
          }),
      })
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(yield* host([server]))
          yield* eventually(Effect.sync(() => starts.length === 1))
          // Stop only after the delayed envelope and its public diagnostic have committed.
          yield* eventually(
            controllerStatus({
              id: controllerAlias(Delayed.id),
              key: item.id,
            }).pipe(Effect.map((status) => status.requeueAt !== null))
          )
        })
      )
      yield* Layer.build(yield* host([server]))
      yield* eventually(Effect.sync(() => starts.length === 2))
      expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(795)
      yield* Effect.sleep("900 millis")
      expect(starts).toHaveLength(2)
      expect(
        (yield* controllerStatus({
          id: controllerAlias(Delayed.id),
          key: item.id,
        })).requeueAt
      ).toBeNull()
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)

fixture.test(
  "an earlier event reconciles immediately when eligible and cancels a stale follow-up",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const items = (yield* Database).repository(Item)
      const item = yield* items.create({ title: "Cancel delayed follow-up" })
      const starts: number[] = []
      const server = defineControllerServer(Delayed, {
        reconcile: () =>
          Effect.gen(function* () {
            starts.push(
              Date.parse(
                (yield* controllerStatus({
                  id: controllerAlias(Delayed.id),
                  key: item.id,
                })).lastStartedAt!
              )
            )
            return starts.length === 1
              ? { requeueAfter: "2 seconds" as const }
              : undefined
          }),
      })
      yield* Layer.build(yield* host([server]))
      yield* eventually(Effect.sync(() => starts.length === 1))
      yield* items.update({ id: item.id, title: "Wake sooner" })
      yield* eventually(Effect.sync(() => starts.length === 2))
      expect(starts[1]! - starts[0]!).toBeLessThan(1900)
      yield* Effect.sleep("2200 millis")
      expect(starts).toHaveLength(2)
      expect(
        (yield* controllerStatus({
          id: controllerAlias(Delayed.id),
          key: item.id,
        })).requeueAt
      ).toBeNull()
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)

fixture.test(
  "pause retains work across restart and registration; resume does not rescan unchanged keys",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const items = database.repository(Item)
      const controllers = database.repository(Controller)
      const id = controllerAlias(Delayed.id)
      const first = yield* items.create({ title: "Changed" })
      const second = yield* items.create({ title: "Unchanged" })
      const starts = new Map<string, number>()
      const server = defineControllerServer(Delayed, {
        reconcile: (key) =>
          Effect.sync(() => {
            starts.set(key, (starts.get(key) ?? 0) + 1)
          }),
      })
      yield* Effect.scoped(
        Effect.gen(function* () {
          yield* Layer.build(yield* host([server]))
          yield* eventually(
            controllerStatus({ id }).pipe(
              Effect.map(
                (status) => status.instances === 2 && status.state === "idle"
              )
            )
          )
          yield* controllers.update({ id, paused: true })
          for (let i = 0; i < 4; i++)
            yield* items.update({ id: first.id, title: `Paused ${i}` })
          yield* database.transaction(() =>
            reconcileController({ id, key: first.id })
          )
          yield* eventually(
            controllerStatus({ id, key: first.id }).pipe(
              Effect.map(
                (status) => status.paused && status.state === "pending"
              )
            )
          )
          yield* Effect.sleep("1200 millis")
          expect(starts.get(first.id)).toBe(1)
        })
      )
      yield* seedModuleSettings()
      expect((yield* controllers.get({ id })).paused).toBe(true)
      yield* Layer.build(yield* host([server]))
      yield* Effect.sleep("1200 millis")
      expect(starts.get(first.id)).toBe(1)
      yield* controllers.update({ id, paused: false })
      yield* eventually(
        controllerStatus({ id, key: first.id }).pipe(
          Effect.map((status) => status.runs === 2 && status.state === "idle")
        )
      )
      yield* Effect.sleep("1000 millis")
      expect(starts.get(first.id)).toBe(2)
      expect(starts.get(second.id)).toBe(1)
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)

fixture.test(
  "pausing does not interrupt an admitted attempt or admit the next one",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const item = yield* database
        .repository(Item)
        .create({ title: "In progress" })
      const id = controllerAlias(Delayed.id)
      const release = yield* Deferred.make<void>()
      let runs = 0
      const server = defineControllerServer(Delayed, {
        reconcile: () =>
          Effect.gen(function* () {
            runs++
            yield* Deferred.await(release)
          }),
      })
      yield* Layer.build(yield* host([server]))
      yield* eventually(Effect.sync(() => runs === 1))
      yield* database
        .repository(Controller)
        .update({ id, paused: true })
        .pipe(Effect.timeout("2 seconds"))
      yield* Deferred.succeed(release, undefined)
      yield* eventually(
        controllerStatus({ id }).pipe(
          Effect.map((status) => status.lastSucceededAt !== null)
        )
      )
      yield* database
        .repository(Item)
        .update({ id: item.id, title: "Pending next attempt" })
      yield* eventually(
        controllerStatus({ id }).pipe(
          Effect.map((status) => status.pending === 1)
        )
      )
      yield* Effect.sleep("1200 millis")
      expect(runs).toBe(1)
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)
