import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import { McpTransport } from "#/app/server/transport/mcp-transport.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { RecordAlias } from "#/runtime/model/index.ts"
import { controllerAlias } from "#/runtime/platform/model/controller.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { ControllerStorage } from "#/runtime/server/controllers/storage.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"

const application = testApplication({
  identityProvider: Layer.succeed(IdentityProvider, {
    identify: (headers) =>
      Effect.succeed(
        headers.has("x-test-user")
          ? {
              issuer: "test",
              subject: "owner",
              kind: "user" as const,
              name: "Owner",
              email: "owner@example.test",
            }
          : null
      ),
  }),
})

application.test(
  "exposes code-owned definitions and writable pause settings and attached status/reconciliation over HTTP and MCP",
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
      const id = controllerAlias("issue-greeting")
      expect(
        yield* anonymous.controller.list({}).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      expect(
        yield* anonymous.controller.status({ id }).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      expect(
        yield* anonymous.controller.reconcile({ id }).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      const listed = yield* client.controller.list({
        filter: { field: "targetObjectType", operator: "eq", value: "issue" },
        expand: { module: true },
      })
      expect(listed.items).toHaveLength(1)
      const canonicalId = listed.items[0]!.id
      expect(canonicalId).toMatch(/^controller_[0-9a-z]{26}$/)
      expect(listed.items[0]).toMatchObject({
        aliases: [id],
        definitionId: "issue-greeting",
        scope: "record",
        links: { module: { moduleId: "product" } },
      })
      expect(yield* client.controller.get({ id })).toMatchObject({
        name: "Issue greeting",
      })
      expect(
        yield* client.controller.status({ id, key: "unseen" })
      ).toMatchObject({
        enabled: true,
        state: "notStarted",
        runs: 0,
        failures: 0,
        instances: 0,
      })
      expect(
        yield* anonymous.controller
          .update({ id, paused: true })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      yield* client.controller.update({ id, paused: true })
      expect(yield* client.controller.status({ id })).toMatchObject({
        enabled: true,
        paused: true,
      })
      yield* client.controller.update({ id, paused: false })
      const issue = yield* client.issue.create({
        title: "Manual reconciliation",
        aliases: [RecordAlias("external:issue:manual")],
      })
      expect(yield* client.controller.reconcile({ id, key: issue.id })).toEqual(
        { accepted: true }
      )
      expect(
        yield* client.controller.reconcile({ id, key: "external:issue:manual" })
      ).toEqual({ accepted: true })
      expect(
        yield* client.controller.status({ id, key: "external:issue:manual" })
      ).toEqual(yield* client.controller.status({ id, key: issue.id }))
      expect(yield* client.controller.reconcile({ id })).toEqual({
        accepted: true,
      })
      const journal = yield* EventJournal
      const requests = yield* journal.list({
        type: "controller.reconciliationRequested",
      })
      expect(requests.items.map((event) => event.data)).toEqual([
        { key: issue.id },
        { key: issue.id },
        { key: null },
      ])
      expect(
        requests.items.every((event) =>
          event.subjects.some((subject) => subject.id === canonicalId)
        )
      ).toBe(true)
      expect(requests.items[0]!.subjects).toContainEqual({
        objectType: "issue",
        id: issue.id,
      })

      // Generated public contracts expose reads and custom operations, only operator settings, never definition writes or legacy globals.
      for (const [method, path, body] of [
        ["POST", "/api/v1/controllers", {}],
        [
          "POST",
          "/api/v1/moduleSettings/system:module:product/controllers:link",
          { ids: [id] },
        ],
        [
          "POST",
          "/api/v1/moduleSettings/system:module:product/controllers:unlink",
          { ids: [id] },
        ],
        ["DELETE", `/api/v1/controllers/${id}`, {}],
        ["POST", "/api/v1/:controllerStatus", { objectType: "issue" }],
        [
          "POST",
          "/api/v1/:reconcileController",
          { controllerId: "issue-greeting" },
        ],
      ] as const) {
        const response = yield* http.handle(
          new Request(`http://company.test${path}`, {
            method,
            headers: {
              "x-test-user": "owner",
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          })
        )
        expect(response.status).toBeGreaterThanOrEqual(400)
      }
      // Unknown/output-only inputs are stripped by the shared decoder; definition fields cannot change.
      yield* http.handle(
        new Request(`http://company.test/api/v1/controllers/${id}`, {
          method: "PATCH",
          headers: {
            "x-test-user": "owner",
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "Changed", paused: true }),
        })
      )
      expect(yield* client.controller.get({ id })).toMatchObject({
        name: "Issue greeting",
        paused: true,
      })
      const mcp = yield* McpTransport
      for (const name of [
        "controller.update",
        "controller.status",
        "controller.reconcile",
        "controller.get",
        "controller.list",
      ]) {
        const response = yield* mcp.handle(
          new Request("http://localhost/api/mcp", {
            method: "POST",
            headers: {
              "x-test-user": "owner",
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
              host: "localhost",
            },
            body: JSON.stringify({
              id: 1,
              jsonrpc: "2.0",
              method: "tools/call",
              params: {
                name,
                arguments:
                  name === "controller.list"
                    ? {}
                    : name === "controller.update"
                      ? { id, paused: true }
                      : { id },
              },
            }),
          })
        )
        const body = yield* Effect.promise(() => response.text())
        expect(body).not.toContain('"isError":true')
        expect(body).toContain('"result"')
      }
      for (const moduleId of [
        "customerFeedback",
        "productDemand",
        "engineering",
        "product",
      ])
        yield* client.moduleSetting.setEnabled({ moduleId, enabled: false })
      expect(yield* client.controller.status({ id })).toMatchObject({
        enabled: false,
      })
      expect(
        (yield* client.controller.list({})).items
          .map((controller) => controller.definitionId)
          .sort()
      ).toEqual([
        "contact-summary",
        "github-discovery",
        "github-repository-sync",
        "issue-greeting",
      ])
      expect(
        yield* client.controller.reconcile({ id }).pipe(Effect.flip)
      ).toMatchObject({ status: "FAILED_PRECONDITION" })
    })
)

application.test(
  "exposes instances through ordinary reads, Links, expansion, and reconciliation while keeping runtime state read-only",
  () =>
    Effect.gen(function* () {
      const http = yield* HttpTransport
      const client = createEffectClient(Model, {
        baseUrl: "http://company.test",
        fetch: (input, init) =>
          Effect.runPromise(http.handle(new Request(input, init))),
        headers: { "x-test-user": "owner" },
      })
      const storage = yield* ControllerStorage
      const issues = yield* Effect.forEach([1, 2, 3, 4], (index) =>
        client.issue.create({ title: `Controlled ${index}` })
      )
      yield* Effect.forEach(issues, (issue) =>
        storage.pending("issue-greeting", issue.id)
      )
      const issue = issues[0]!
      yield* storage.started("issue-greeting", issue.id)
      yield* storage.failed("issue-greeting", issue.id, "Try again")
      yield* storage.saveSession("issue-greeting", issue.id, {
        id: "test-session",
        url: "https://agent.example.test/sessions/test",
      })
      const page = yield* client.controllerInstance.list({
        filter: {
          link: "record",
          some: { field: "id", operator: "eq", value: issue.id },
        },
        expand: { controller: true, record: true },
      })
      expect(page.items).toHaveLength(1)
      const instance = page.items[0]!
      expect(instance).toMatchObject({
        state: "error",
        runs: 1,
        failures: 1,
        lastError: "Try again",
        agentSessionId: "test-session",
        links: {
          controller: { definitionId: "issue-greeting" },
          record: { id: issue.id, title: issue.title },
        },
      })
      const controller = yield* client.controller.get({
        id: controllerAlias("issue-greeting"),
        expand: { instances: true },
      })
      expect(controller.links.instances.totalSize).toBe(4)
      expect(controller.links.instances.items).toHaveLength(3)
      const all = yield* client.controller.instances.list({ id: controller.id })
      expect(all.items).toHaveLength(4)
      const contactView = yield* client.issue.get({
        id: issue.id,
        expand: { controllerInstances: true },
      })
      expect(contactView.links.controllerInstances.items[0]?.id).toBe(
        instance.id
      )
      expect(
        yield* client.controllerInstance.reconcile({ id: instance.id })
      ).toEqual({ accepted: true })
      const requests = yield* (yield* EventJournal).list({
        type: "controller.reconciliationRequested",
      })
      expect(requests.items.at(-1)?.data).toEqual({ key: issue.id })
      for (const method of ["PATCH", "DELETE"])
        expect(
          (yield* http.handle(
            new Request(
              `http://company.test/api/v1/controllerInstances/${instance.id}`,
              {
                method,
                headers: {
                  "x-test-user": "owner",
                  "content-type": "application/json",
                },
                body: JSON.stringify({ state: "idle" }),
              }
            )
          )).status
        ).toBeGreaterThanOrEqual(400)
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
          body: JSON.stringify({
            id: 1,
            jsonrpc: "2.0",
            method: "tools/call",
            params: {
              name: "controllerInstance.get",
              arguments: { id: instance.id, expand: { controller: true } },
            },
          }),
        })
      )
      const body = yield* Effect.promise(() => response.text())
      expect(body).not.toContain('"isError":true')
      expect(body).toContain("test-session")
      yield* client.issue.delete({ id: issue.id })
      expect(
        yield* client.controllerInstance
          .get({ id: instance.id })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "NOT_FOUND" })
      expect(yield* storage.pending("issue-greeting", issue.id)).toBe(false)
    }).pipe(Effect.provide(ControllerStorage.layer))
)
