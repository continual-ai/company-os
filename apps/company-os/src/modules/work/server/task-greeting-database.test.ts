import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { Clock, Context, Effect, Layer, Schedule } from "effect"
import { SingleRunner } from "effect/unstable/cluster"
import { SqlClient } from "effect/unstable/sql"
import { expect } from "vitest"

import { Task, WorkModule } from "#/modules/work/model/index.ts"
import {
  defineController,
  defineModel,
  defineModule,
} from "#/runtime/model/index.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"
import {
  PlatformModule,
  ModuleSetting,
} from "#/runtime/platform/model/index.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { controllerStatus } from "#/runtime/platform/server/controller-status.ts"
import { reconcileController } from "#/runtime/platform/server/reconcile-controller.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import {
  Database,
  defineControllerServer,
  defineModuleServer,
} from "#/runtime/server/index.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const TaskGreeting = defineController({
  id: "task-greeting",
  name: "Task greeting",
  description:
    "Ensures each task has a Hello world note. Demonstrates durable, idempotent reconciliation.",
  record: Task,
  schedule: { cron: "*/15 * * * *", timeZone: "UTC" },
  minInterval: "1 second",
  watch: ["notes"],
})

const taskGreeting = defineControllerServer(TaskGreeting, {
  reconcile: Effect.fn("taskGreeting.reconcile")(function* (taskId) {
    const database = yield* Database
    yield* database.transaction(() =>
      Effect.gen(function* () {
        // Lock the target through the read/create transaction, including against deletion.
        const rows =
          yield* database.sql`select id from ${database.table(Task)} where id = ${taskId} for update`
        if (rows.length === 0) return
        const notes = database.repository(Note)
        const existing = yield* notes.list({
          filter: {
            and: [
              { field: "content", operator: "eq", value: "Hello world" },
              {
                link: "subjects",
                some: { field: "id", operator: "eq", value: taskId },
              },
            ],
          },
          pageSize: 1,
        })
        if (existing.items.length > 0) return
        yield* notes.create({
          content: "Hello world",
          links: { subjects: [taskId] },
        })
      })
    )
  }),
})

const GreetingModule = defineModule({
  id: "greetingTest",
  name: "Greeting test",
  controllers: [TaskGreeting],
})
const GreetingServer = defineModuleServer(GreetingModule, {
  controllers: [taskGreeting],
})

const Model = defineModel({
  name: "Greeting test",
  modules: [PlatformModule, WorkModule, GreetingModule],
})
const fixture = testFoundation(Model, { servers: [GreetingServer] })
const liveClock = Context.get(Context.empty(), Clock.Clock)

fixture.test(
  "creates one greeting, repairs edits and deletion, and resumes after module activation",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const tasks = database.repository(Task)
      const notes = database.repository(Note)
      const task = yield* tasks.create({ title: "Deliver a controller" })
      const cluster = SingleRunner.layer({
        runnerStorage: "memory",
        shardingConfig: {
          entityMessagePollInterval: "20 millis",
          entityTerminationTimeout: "20 millis",
        },
      }).pipe(
        Layer.provide(NodeCrypto.layer),
        Layer.provide(Layer.succeed(SqlClient.SqlClient, database.sql))
      )
      const host = controllerLayer(Model, GreetingServer.controllers[0]).pipe(
        Layer.provide(cluster),
        Layer.provide(EventNotifications.layerPolling)
      )
      const greetings = notes.list({
        filter: {
          and: [
            { field: "content", operator: "eq", value: "Hello world" },
            {
              link: "subjects",
              some: { field: "id", operator: "eq", value: task.id },
            },
          ],
        },
      })
      const waitForGreeting = greetings.pipe(
        Effect.repeat({
          until: (page) => page.items.length === 1,
          schedule: Schedule.spaced("20 millis"),
        }),
        Effect.timeout("15 seconds"),
        Effect.map((page) => page.items[0]!)
      )
      yield* Layer.build(host)
      const initial = yield* waitForGreeting
      // Separate manual requests must execute again without creating duplicate notes.
      for (let attempt = 0; attempt < 2; attempt++) {
        const before = yield* controllerStatus({
          id: controllerAlias("task-greeting"),
          key: task.id,
        })
        yield* database.transaction(() =>
          reconcileController({
            id: controllerAlias("task-greeting"),
            key: task.id,
          })
        )
        yield* controllerStatus({
          id: controllerAlias("task-greeting"),
          key: task.id,
        }).pipe(
          Effect.repeat({
            until: (status) =>
              status.runs > before.runs &&
              status.lastSucceededAt !== before.lastSucceededAt,
            schedule: Schedule.spaced("20 millis"),
          }),
          Effect.timeout("15 seconds")
        )
        expect((yield* greetings).items.map((note) => note.id)).toEqual([
          initial.id,
        ])
      }
      for (let i = 0; i < 5; i++)
        yield* tasks.update({ id: task.id, title: `Revision ${i}` })
      yield* GreetingServer.controllers[0].reconcile(task.id)
      expect((yield* greetings).items.map((note) => note.id)).toEqual([
        initial.id,
      ])
      yield* notes.update({ id: initial.id, content: "Edited greeting" })
      const repaired = yield* waitForGreeting
      expect(repaired.id).not.toBe(initial.id)
      yield* notes.delete({ id: repaired.id })
      const replaced = yield* waitForGreeting
      expect(replaced.id).not.toBe(repaired.id)
      yield* notes.update({ id: replaced.id, links: { subjects: [] } })
      expect((yield* waitForGreeting).id).not.toBe(replaced.id)
      const status = yield* controllerStatus({
        id: controllerAlias("task-greeting"),
        key: task.id,
      })
      expect(status).toMatchObject({
        instances: 1,
      })
      const setting = moduleAlias("greetingTest")
      yield* database
        .repository(ModuleSetting)
        .update({ id: setting, enabled: false })
      expect(
        (yield* controllerStatus({ id: controllerAlias("task-greeting") }))
          .enabled
      ).toBe(false)
      const paused = yield* tasks.create({ title: "Created while disabled" })
      const pausedGreetings = notes.list({
        filter: {
          link: "subjects",
          some: { field: "id", operator: "eq", value: paused.id },
        },
      })
      yield* Effect.sleep("1200 millis")
      expect((yield* pausedGreetings).items).toEqual([])
      yield* tasks.delete({ id: task.id })
      yield* database
        .repository(ModuleSetting)
        .update({ id: setting, enabled: true })
      yield* pausedGreetings.pipe(
        Effect.repeat({
          until: (page) => page.items.length === 1,
          schedule: Schedule.spaced("20 millis"),
        }),
        Effect.timeout("15 seconds")
      )
      yield* GreetingServer.controllers[0].reconcile(task.id)
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)
