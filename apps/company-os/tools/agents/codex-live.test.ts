import { randomUUID } from "node:crypto"
import { tmpdir } from "node:os"

import { NodeServices } from "@effect/platform-node"
import { Codex } from "@openai/codex-sdk"
import { Clock, Context, Effect, Layer, Schedule } from "effect"
import { SingleRunner } from "effect/unstable/cluster"
import { SqlClient } from "effect/unstable/sql"
import { expect } from "vitest"

import { Contact } from "#/modules/crm/model/contact.ts"
import { CrmModule } from "#/modules/crm/model/index.ts"
import { CrmServer } from "#/modules/crm/server/index.ts"
import { defineModel } from "#/runtime/model/index.ts"
import {
  ControllerInstance,
  controllerInstanceAlias,
} from "#/runtime/platform/model/controller-instance.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"
import { PlatformModule } from "#/runtime/platform/model/index.ts"
import { Note } from "#/runtime/platform/model/note.ts"
import { controllerStatus } from "#/runtime/platform/server/controller-status.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import { CodexAgent } from "#/runtime/server/codex-agent.ts"
import { controllerLayer } from "#/runtime/server/controllers/runtime.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventNotifications } from "#/runtime/server/events/event-notifications.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"
import { serveTestMcp } from "#/runtime/testing/mcp-server.ts"

const Model = defineModel({
  name: "Contact enrichment live test",
  modules: [PlatformModule, CrmModule],
})
const fixture = testFoundation(Model, { servers: [CrmServer] })
const liveClock = Context.get(Context.empty(), Clock.Clock)

// Explicit opt-in: real Codex, MCP, database, and durable controller execution.
fixture.test(
  "Codex enriches a contact and refreshes from a changed note through MCP",
  () =>
    Effect.gen(function* () {
      yield* seedModuleSettings()
      const database = yield* Database
      const contacts = database.repository(Contact)
      const notes = database.repository(Note)
      const contact = yield* contacts.create({
        name: "Synthetic Company OS test contact",
      })
      const first = `PROJECT-${randomUUID()}`
      const second = `PROJECT-${randomUUID()}`
      const note = yield* notes.create({
        content: `This is a synthetic test contact, not a real person. Their current primary project is ${first}. This exact project identifier is essential context for their summary.`,
        links: { subjects: [contact.id] },
      })
      const mcp = yield* serveTestMcp
      const agent = CodexAgent.layer(
        new Codex({
          // Desktop tools can target the user's open app instead of this isolated MCP server.
          env: Object.fromEntries(
            Object.entries(process.env).flatMap(([key, value]) =>
              key === "CODEX_APP_TOOLS_PIPE_PATH" || value === undefined
                ? []
                : [[key, value]]
            )
          ),
          config: {
            mcp_servers: { company_os: { url: mcp.url, required: true } },
          },
        }),
        {
          model: "gpt-5.6-luna",
          modelReasoningEffort: "low",
          workingDirectory: tmpdir(),
          skipGitRepoCheck: true,
          sandboxMode: "read-only",
          approvalPolicy: "never",
          webSearchMode: "live",
        }
      )
      const cluster = SingleRunner.layer({
        runnerStorage: "memory",
        shardingConfig: {
          entityMessagePollInterval: "20 millis",
          entityTerminationTimeout: "20 millis",
        },
      }).pipe(
        Layer.provide(NodeServices.layer),
        Layer.provide(Layer.succeed(SqlClient.SqlClient, database.sql))
      )
      yield* Layer.build(
        controllerLayer(Model, CrmServer.controllers[0]).pipe(
          Layer.provide(cluster),
          Layer.provide(EventNotifications.layerPolling),
          Layer.provide(agent)
        )
      )
      const status = controllerStatus({
        id: controllerAlias("contact-summary"),
        key: contact.id,
      })
      const waitForSummary = (text: string) =>
        Effect.gen(function* () {
          const record = yield* contacts.get({ id: contact.id })
          const current = yield* status
          return { record, current }
        }).pipe(
          Effect.repeat({
            until: ({ record, current }) =>
              !!record.summary?.includes(text) && current.state === "idle",
            schedule: Schedule.spaced("250 millis"),
          }),
          Effect.timeout("150 seconds")
        )
      const initial = yield* waitForSummary(first)
      const sessionId = database
        .repository(ControllerInstance)
        .get({ id: controllerInstanceAlias("contact-summary", contact.id) })
        .pipe(Effect.map((instance) => instance.agentSessionId))
      const firstSessionId = yield* sessionId
      expect(firstSessionId).toEqual(expect.any(String))
      expect(initial.current.agentSessionUrl).toBeNull()
      yield* notes.update({
        id: note.id,
        content: `This is a synthetic test contact. Their current primary project is ${second}. This replaces the previous project; the old project is no longer relevant. Include the exact current project identifier in their summary.`,
      })
      const refreshed = yield* waitForSummary(second)
      expect(yield* sessionId).toBe(firstSessionId)
      expect(refreshed.current.agentSessionUrl).toBeNull()
      expect(mcp.calls).toContain("contact.get")
      expect(mcp.calls).toContain("contact.update")
      const runs = refreshed.current.runs
      yield* Effect.sleep("3 seconds")
      expect((yield* status).runs).toBe(runs)
    }).pipe(Effect.scoped, Effect.provideService(Clock.Clock, liveClock)),
  330_000
)
