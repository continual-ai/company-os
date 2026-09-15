import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { Clock, Context, Effect, Layer, Schedule } from "effect"
import { SingleRunner } from "effect/unstable/cluster"
import { SqlClient } from "effect/unstable/sql"
import { expect } from "vitest"

import { Note, NotesModule } from "#/modules/notes/model/index.ts"
import { Issue, ProductModule } from "#/modules/product/model/index.ts"
import { ProductServer } from "#/modules/product/server/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"
import {
  PlatformModule,
  ModuleSetting,
} from "#/runtime/platform/model/index.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { controllerStatus } from "#/runtime/platform/server/controller-status.ts"
import { reconcileController } from "#/runtime/platform/server/reconcile-controller.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Model = defineModel({
  name: "Greeting test",
  modules: [PlatformModule, NotesModule, ProductModule],
})
const fixture = testFoundation(Model, { servers: [ProductServer] })
const liveClock = Context.get(Context.empty(), Clock.Clock)

fixture.test(
  "creates one greeting, repairs edits and deletion, and resumes after module activation",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const issues = database.repository(Issue)
      const notes = database.repository(Note)
      const issue = yield* issues.create({ title: "Deliver a controller" })
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
      const host = controllerLayer(Model, ProductServer.controllers[0]).pipe(
        Layer.provide(cluster),
        Layer.provide(EventNotifications.layerPolling)
      )
      const greetings = notes.list({
        filter: {
          and: [
            { field: "content", operator: "eq", value: "Hello world" },
            {
              link: "subjects",
              some: { field: "id", operator: "eq", value: issue.id },
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
          id: controllerAlias("issue-greeting"),
          key: issue.id,
        })
        yield* database.transaction(() =>
          reconcileController({
            id: controllerAlias("issue-greeting"),
            key: issue.id,
          })
        )
        yield* controllerStatus({
          id: controllerAlias("issue-greeting"),
          key: issue.id,
        }).pipe(
          Effect.repeat({
            until: (status) =>
              status.attempts > before.attempts &&
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
        yield* issues.update({ id: issue.id, title: `Revision ${i}` })
      yield* ProductServer.controllers[0].reconcile(issue.id)
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
        id: controllerAlias("issue-greeting"),
        key: issue.id,
      })
      expect(status).toMatchObject({
        instances: 1,
      })
      const setting = moduleAlias("product")
      yield* database
        .repository(ModuleSetting)
        .update({ id: setting, enabled: false })
      expect(
        (yield* controllerStatus({ id: controllerAlias("issue-greeting") }))
          .enabled
      ).toBe(false)
      const paused = yield* issues.create({ title: "Created while disabled" })
      const pausedGreetings = notes.list({
        filter: {
          link: "subjects",
          some: { field: "id", operator: "eq", value: paused.id },
        },
      })
      yield* Effect.sleep("1200 millis")
      expect((yield* pausedGreetings).items).toEqual([])
      yield* issues.delete({ id: issue.id })
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
      yield* ProductServer.controllers[0].reconcile(issue.id)
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)
