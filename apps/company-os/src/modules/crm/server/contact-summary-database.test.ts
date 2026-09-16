import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { Clock, Context, Effect, Layer, Schedule, type Schema } from "effect"
import { SingleRunner } from "effect/unstable/cluster"
import { SqlClient } from "effect/unstable/sql"
import { expect } from "vitest"

import { Account } from "#/modules/crm/model/account.ts"
import { Affiliation } from "#/modules/crm/model/affiliation.ts"
import { Contact } from "#/modules/crm/model/contact.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { controllerStatus } from "#/runtime/platform/server/controller-status.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import {
  Agent,
  AgentSession,
  AgentError,
  type AgentRunOptions,
} from "#/runtime/server/agent.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { systemInvocation } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Model = defineModel({
  name: "Contact summary test",
  modules: [PlatformModule, CrmModule],
})
const fixture = testFoundation(Model, { servers: [CrmServer] })
const liveClock = Context.get(Context.empty(), Clock.Clock)

fixture.test(
  "enriches contacts, routes notes and links, and ignores summary-only updates",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const contacts = database.repository(Contact)
      const notes = database.repository(Note)
      const contact = yield* contacts.create({ name: "Synthetic contact" })
      const note = yield* notes.create({
        content: "Original context",
        links: { subjects: [contact.id] },
      })
      let calls = 0
      const sessionIds: Array<string | undefined> = []
      function run<A>(
        options: AgentRunOptions & {
          readonly outputSchema: Schema.Codec<A, unknown>
        }
      ): Effect.Effect<A, AgentError, AgentSession>
      function run(
        options: AgentRunOptions & { readonly outputSchema?: undefined }
      ): Effect.Effect<void, AgentError, AgentSession>
      function run(
        options: AgentRunOptions & {
          readonly outputSchema?: Schema.Codec<unknown, unknown> | undefined
        }
      ): Effect.Effect<unknown, AgentError, AgentSession> {
        return Effect.gen(function* () {
          if (options.outputSchema)
            return yield* Effect.fail(
              new AgentError({
                message: "This fake only supports tool-driven runs",
              })
            )
          const session = yield* AgentSession
          sessionIds.push((yield* session.current)?.id)
          yield* session.save({
            id: "summary-thread",
            url: "codex://threads/summary-thread",
          })
          calls++
          // Simulates a tool-using agent; the live test uses the actual MCP transport.
          const context = yield* notes.list({
            filter: {
              link: "subjects",
              some: { field: "id", operator: "eq", value: contact.id },
            },
          })
          yield* contacts.update({
            id: contact.id,
            summary:
              context.items.map((item) => item.content).join("\n") ||
              "No notes",
          })
          return undefined
        }).pipe(
          Effect.provideService(CurrentInvocation, systemInvocation),
          Effect.mapError(
            (cause) => new AgentError({ message: "Fake agent failed", cause })
          )
        )
      }
      const agent = Agent.of({ run })
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
      const host = controllerLayer(Model, CrmServer.controllers[0]).pipe(
        Layer.provide(cluster),
        Layer.provide(EventNotifications.layerPolling),
        Layer.provide(Layer.succeed(Agent, agent))
      )
      const status = controllerStatus({
        id: controllerAlias("contact-summary"),
        key: contact.id,
      })
      const waitForCalls = (count: number) =>
        status.pipe(
          Effect.repeat({
            until: (value) => calls >= count && value.state === "idle",
            schedule: Schedule.spaced("20 millis"),
          }),
          Effect.timeout("15 seconds")
        )
      yield* Layer.build(host)
      yield* waitForCalls(1)
      expect((yield* contacts.get({ id: contact.id })).summary).toBe(
        "Original context"
      )
      yield* Effect.sleep("2500 millis")
      expect(calls).toBe(1)
      expect((yield* status).agentSessionUrl).toBe(
        "codex://threads/summary-thread"
      )
      yield* notes.update({ id: note.id, content: "Revised context" })
      yield* waitForCalls(2)
      expect((yield* contacts.get({ id: contact.id })).summary).toBe(
        "Revised context"
      )
      expect(sessionIds).toEqual([undefined, "summary-thread"])
      yield* notes.update({ id: note.id, links: { subjects: [] } })
      yield* waitForCalls(3)
      expect((yield* contacts.get({ id: contact.id })).summary).toBe("No notes")
      const account = yield* database
        .repository(Account)
        .create({ name: "Example company" })
      yield* database.repository(Affiliation).create({
        jobTitle: "Engineer",
        links: { contact: contact.id, account: account.id },
      })
      yield* waitForCalls(4)
      const before = calls
      yield* database
        .repository(Account)
        .update({ id: account.id, name: "Renamed company" })
      yield* waitForCalls(before + 1)
      // Link creation emits several facts; let their queued reconciliations drain.
      yield* Effect.sleep("3 seconds")
      const after = calls
      yield* contacts.update({ id: contact.id, summary: "Manual summary edit" })
      yield* Effect.sleep("2500 millis")
      expect(calls).toBe(after)
      yield* contacts.update({
        id: contact.id,
        name: "Updated contact",
        summary: "Outdated summary",
      })
      yield* waitForCalls(after + 1)
      expect((yield* contacts.get({ id: contact.id })).summary).toBe("No notes")
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock))
)
