import { Effect, Layer, Schema } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { activeOpenApiDocument } from "#/app/server/http-api.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { McpTransport } from "#/app/server/transport/mcp-transport.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { activeModuleModel } from "#/runtime/platform/server/index.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"

const application = testApplication({
  configuration: {},
  identityProvider: Layer.succeed(IdentityProvider, {
    identify: (headers) => {
      const subject = headers.get("x-test-user")
      const actor = {
        issuer: "test",
        email: `${subject}@example.test`,
        subject: subject ?? "",
        kind: "user" as const,
        name: subject ?? "",
      }
      return Effect.succeed(subject ? actor : null)
    },
  }),
})

application.test(
  "Feedback uses admitted CRUD and retains evidence while disabled",
  () =>
    Effect.gen(function* () {
      const http = yield* HttpTransport
      const fetch: typeof globalThis.fetch = (input, init) =>
        Effect.runPromise(http.handle(new Request(input, init)))
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
        headers: { "x-test-user": "owner" },
      })
      const anonymous = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
      })
      expect(
        yield* anonymous.feedback.create({ title: "Denied" }).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      const report = yield* client.feedback.create({
        title: "Service access is too narrow",
      })
      const task = yield* client.task.create({
        title: "Review service clearance",
        links: { feedback: [report.id] },
      })
      expect(
        (yield* client.feedback.get({ id: report.id, expand: true })).links
          .tasks.items
      ).toMatchObject([{ id: task.id }])
      yield* client.moduleSetting.setEnabled({
        moduleId: "feedback",
        enabled: false,
      })
      expect(
        yield* client.feedback.get({ id: report.id }).pipe(Effect.flip)
      ).toMatchObject({ status: "PERMISSION_DENIED" })
      expect((yield* client.task.get({ id: task.id })).title).toBe(
        "Review service clearance"
      )
      yield* client.moduleSetting.setEnabled({
        moduleId: "feedback",
        enabled: true,
      })
      expect(
        (yield* client.feedback.get({ id: report.id })).links.tasks.ids
      ).toEqual([task.id])
    })
)

application.test(
  "exposes Work hierarchy and dependencies with sanitized cycle errors and admission",
  () =>
    Effect.gen(function* () {
      const http = yield* HttpTransport
      const fetch: typeof globalThis.fetch = (input, init) =>
        Effect.runPromise(http.handle(new Request(input, init)))
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
        headers: { "x-test-user": "owner" },
      })
      const anonymous = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
      })
      expect(
        yield* anonymous.task.create({ title: "Denied" }).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      const parent = yield* client.task.create({ title: "Deliver workshop" })
      const child = yield* client.task.create({
        title: "Install panels",
        links: { parent: parent.id },
      })
      expect(
        yield* client.task.subtasks
          .link({ id: child.id, target: parent.id })
          .pipe(Effect.flip)
      ).toMatchObject({
        status: "INVALID_ARGUMENT",
        message: "Task hierarchy cannot contain a cycle.",
      })
      yield* client.task.dependsOn.link({ id: child.id, target: parent.id })
      expect(
        yield* client.task.dependsOn
          .link({ id: parent.id, target: child.id })
          .pipe(Effect.flip)
      ).toMatchObject({
        status: "INVALID_ARGUMENT",
        message: "Task dependencies cannot contain a cycle.",
      })
      expect(
        (yield* client.task.get({ id: child.id, expand: true })).links.parent
      ).toMatchObject({ id: parent.id })
      expect(
        (yield* client.task.subtasks.list({ id: parent.id })).items.map(
          ({ id }) => id
        )
      ).toEqual([child.id])
    })
)

application.test(
  "activation governs discovery and operations, preserves records and survives system seeding",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const fetch: typeof globalThis.fetch = (input, init) =>
        Effect.runPromise(api.handle(new Request(input, init)))
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
        headers: { "x-test-user": "owner" },
      })
      const operator = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
        headers: { "x-test-user": "operator" },
      })
      const catalog = yield* operator.moduleSetting.catalog({})
      expect(catalog.modules).toHaveLength(Object.keys(Model.modules).length)
      expect(
        catalog.modules.find((module) => module.id === "platform")
      ).toMatchObject({
        maturity: "alpha",
        maintainer: Model.maintainer,
        origin: {
          name: "Company OS",
          url: "https://github.com/continual-ai/company-os",
        },
      })
      yield* operator.moduleSetting.setEnabled({
        moduleId: "hiring",
        enabled: false,
      })
      yield* operator.moduleSetting.setEnabled({
        moduleId: "hiring",
        enabled: true,
      })
      const checkpoint = yield* client.events.list({ cursor: "now" })
      const job = yield* client.jobPosting.create({
        title: "Retained role",
        description: "Keeps its data",
      })
      yield* client.moduleSetting.setEnabled({
        moduleId: "hiring",
        enabled: false,
      })
      expect(
        yield* client.jobPosting.get({ id: job.id }).pipe(Effect.flip)
      ).toMatchObject({ status: "PERMISSION_DENIED" })
      expect(
        (yield* client.records.search({ query: "Retained" })).items.some(
          (hit) => hit.id === job.id
        )
      ).toBe(false)
      expect(
        (yield* client.events.list({
          cursor: checkpoint.nextCursor,
        })).items.some((event) =>
          event.subjects.some((subject) => subject.objectType === "jobPosting")
        )
      ).toBe(false)
      const active = yield* activeModuleModel()
      expect(active.model.objects.jobPosting).toBeUndefined()
      expect(JSON.stringify(activeOpenApiDocument(active.model))).not.toContain(
        '"/api/v1/jobPostings'
      )
      const mcp = yield* McpTransport
      const response = yield* mcp.handle(
        new Request("http://localhost/api/mcp", {
          method: "POST",
          headers: {
            "x-test-user": "owner",
            accept: "application/json, text/event-stream",
            "content-type": "application/json",
            host: "localhost",
          },
          body: JSON.stringify({ id: 1, jsonrpc: "2.0", method: "tools/list" }),
        })
      )
      const body = yield* Effect.promise(() => response.text())
      const json =
        body
          .split("\n")
          .find((line) => line.startsWith("data:"))
          ?.slice(5)
          .trim() ?? body
      const payload = Schema.decodeUnknownSync(
        Schema.Struct({
          result: Schema.Struct({
            tools: Schema.Array(Schema.Struct({ name: Schema.String })),
          }),
        })
      )(JSON.parse(json))
      expect(
        payload.result.tools.some(({ name }) => name.startsWith("jobPosting."))
      ).toBe(false)
      expect(
        payload.result.tools.some(
          ({ name }) => name === "moduleSetting.setEnabled"
        )
      ).toBe(true)
      yield* seedSystem()
      expect(
        (yield* client.moduleSetting.catalog({})).modules.find(
          ({ id }) => id === "hiring"
        )?.enabled
      ).toBe(false)
      yield* client.moduleSetting.setEnabled({
        moduleId: "hiring",
        enabled: true,
      })
      expect((yield* client.jobPosting.get({ id: job.id })).title).toBe(
        "Retained role"
      )
    })
)

application.test("required modules and dependency closure are enforced", () =>
  Effect.gen(function* () {
    const api = yield* HttpTransport
    const fetch: typeof globalThis.fetch = (input, init) =>
      Effect.runPromise(api.handle(new Request(input, init)))
    const client = createEffectClient(Model, {
      baseUrl: "http://company.test",
      fetch,
      headers: { "x-test-user": "owner" },
    })
    for (const moduleId of ["platform", "missing"]) {
      expect(
        yield* client.moduleSetting
          .setEnabled({ moduleId, enabled: false })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
    }
    yield* client.moduleSetting.setEnabled({
      moduleId: "feedback",
      enabled: false,
    })
    yield* client.moduleSetting.setEnabled({
      moduleId: "service",
      enabled: false,
    })
    const result = yield* client.moduleSetting.setEnabled({
      moduleId: "feedback",
      enabled: true,
    })
    expect(result.enabledModules).toEqual(
      expect.arrayContaining(["feedback", "service", "work"])
    )
  })
)

application.test(
  "turns off dependent modules only after explicit confirmation and keeps the core available",
  () =>
    Effect.gen(function* () {
      const api = yield* HttpTransport
      const fetch: typeof globalThis.fetch = (input, init) =>
        Effect.runPromise(api.handle(new Request(input, init)))
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch,
        headers: { "x-test-user": "owner" },
      })
      const before = yield* client.moduleSetting.catalog({})
      expect(
        yield* client.moduleSetting
          .setEnabled({
            moduleId: "crm",
            enabled: false,
            disableDependents: ["sales"],
          })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      expect(yield* client.moduleSetting.catalog({})).toEqual(before)
      const result = yield* client.moduleSetting.setEnabled({
        moduleId: "crm",
        enabled: false,
        disableDependents: [
          "sales",
          "marketing",
          "service",
          "feedback",
          "workDemand",
        ],
      })
      expect(result.enabledModules).toEqual([
        "platform",
        "work",
        "engineering",
        "hiring",
      ])
      const note = yield* client.note.create({
        content: "Notes stay available without CRM.",
      })
      expect((yield* client.note.get({ id: note.id })).content).toBe(
        note.content
      )
      yield* client.moduleSetting.setEnabled({
        moduleId: "service",
        enabled: true,
      })
      const enabled = (yield* client.moduleSetting.catalog({})).modules
        .filter((module) => module.enabled)
        .map((module) => module.id)
      expect(enabled).toEqual([
        "platform",
        "crm",
        "work",
        "engineering",
        "hiring",
        "service",
      ])
    })
)
