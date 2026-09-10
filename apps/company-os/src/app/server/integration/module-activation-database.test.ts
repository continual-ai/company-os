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
        catalog.modules.find((module) => module.id === "notes")
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
        (yield* client.records.search({ query: "Retained" })).hits.some(
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
    for (const moduleId of ["platform", "notes", "missing"]) {
      expect(
        yield* client.moduleSetting
          .setEnabled({ moduleId, enabled: false })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
    }
    yield* client.moduleSetting.setEnabled({
      moduleId: "supportEngineering",
      enabled: false,
    })
    yield* client.moduleSetting.setEnabled({
      moduleId: "support",
      enabled: false,
    })
    const result = yield* client.moduleSetting.setEnabled({
      moduleId: "supportEngineering",
      enabled: true,
    })
    expect(result.enabledModules).toEqual(
      expect.arrayContaining(["supportEngineering", "support", "engineering"])
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
            moduleId: "notes",
            enabled: false,
            disableDependents: ["sales"],
          })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
      expect(yield* client.moduleSetting.catalog({})).toEqual(before)
      const result = yield* client.moduleSetting.setEnabled({
        moduleId: "notes",
        enabled: false,
        disableDependents: [
          "sales",
          "marketing",
          "engineering",
          "hiring",
          "support",
          "supportEngineering",
        ],
      })
      expect(result.enabledModules).toEqual(["platform"])
      yield* client.moduleSetting.setEnabled({
        moduleId: "support",
        enabled: true,
      })
      const enabled = (yield* client.moduleSetting.catalog({})).modules
        .filter((module) => module.enabled)
        .map((module) => module.id)
      expect(enabled).toEqual(["platform", "notes", "sales", "support"])
    })
)
