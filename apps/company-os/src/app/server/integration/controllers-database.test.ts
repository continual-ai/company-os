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
      const id = controllerAlias("contact-summary")
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
        filter: { field: "targetObjectType", operator: "eq", value: "contact" },
        expand: { module: true },
      })
      expect(listed.items).toHaveLength(1)
      const canonicalId = listed.items[0]!.id
      expect(canonicalId).toMatch(/^controller_[0-9a-z]{26}$/)
      expect(listed.items[0]).toMatchObject({
        aliases: [id],
        definitionId: "contact-summary",
        scope: "record",
        links: { module: { moduleId: "crm" } },
      })
      expect(yield* client.controller.get({ id })).toMatchObject({
        name: "Contact summary",
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
      const contact = yield* client.contact.create({
        name: "Manual reconciliation",
        aliases: [RecordAlias("external:contact:manual")],
      })
      expect(
        yield* client.controller.reconcile({ id, key: contact.id })
      ).toEqual({
        accepted: true,
      })
      expect(
        yield* client.controller.reconcile({
          id,
          key: "external:contact:manual",
        })
      ).toEqual({ accepted: true })
      expect(
        yield* client.controller.status({ id, key: "external:contact:manual" })
      ).toEqual(yield* client.controller.status({ id, key: contact.id }))
      expect(yield* client.controller.reconcile({ id })).toEqual({
        accepted: true,
      })
      const journal = yield* EventJournal
      const requests = yield* journal.list({
        type: "controller.reconciliationRequested",
      })
      expect(requests.items.map((event) => event.data)).toEqual([
        { key: contact.id },
        { key: contact.id },
        { key: null },
      ])
      expect(
        requests.items.every((event) =>
          event.subjects.some((subject) => subject.id === canonicalId)
        )
      ).toBe(true)
      expect(requests.items[0]!.subjects).toContainEqual({
        objectType: "contact",
        id: contact.id,
      })

      // Generated public contracts expose reads and custom operations, only operator settings, never definition writes or legacy globals.
      for (const [method, path, body] of [
        ["POST", "/api/v1/controllers", {}],
        [
          "POST",
          "/api/v1/moduleSettings/system:module:crm/controllers:link",
          { ids: [id] },
        ],
        [
          "POST",
          "/api/v1/moduleSettings/system:module:crm/controllers:unlink",
          { ids: [id] },
        ],
        ["DELETE", `/api/v1/controllers/${id}`, {}],
        ["POST", "/api/v1/:controllerStatus", { objectType: "contact" }],
        [
          "POST",
          "/api/v1/:reconcileController",
          { controllerId: "contact-summary" },
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
        name: "Contact summary",
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
      yield* client.moduleSetting.setEnabled({
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
      const contacts = yield* Effect.forEach([1, 2, 3, 4], (index) =>
        client.contact.create({ name: `Controlled ${index}` })
      )
      yield* Effect.forEach(contacts, (contact) =>
        storage.pending("contact-summary", contact.id)
      )
      const contact = contacts[0]!
      yield* storage.started("contact-summary", contact.id)
      yield* storage.failed("contact-summary", contact.id, "Try again")
      yield* storage.saveSession("contact-summary", contact.id, {
        id: "test-session",
        url: "https://agent.example.test/sessions/test",
      })
      const page = yield* client.controllerInstance.list({
        filter: {
          link: "record",
          some: { field: "id", operator: "eq", value: contact.id },
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
          controller: { definitionId: "contact-summary" },
          record: { id: contact.id, name: contact.name },
        },
      })
      const controller = yield* client.controller.get({
        id: controllerAlias("contact-summary"),
        expand: { instances: true },
      })
      expect(controller.links.instances.totalSize).toBe(4)
      expect(controller.links.instances.items).toHaveLength(3)
      const all = yield* client.controller.instances.list({ id: controller.id })
      expect(all.items).toHaveLength(4)
      const contactView = yield* client.contact.get({
        id: contact.id,
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
      expect(requests.items.at(-1)?.data).toEqual({ key: contact.id })
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
      yield* client.contact.delete({ id: contact.id })
      expect(
        yield* client.controllerInstance
          .get({ id: instance.id })
          .pipe(Effect.flip)
      ).toMatchObject({ status: "NOT_FOUND" })
      expect(yield* storage.pending("contact-summary", contact.id)).toBe(false)
    }).pipe(Effect.provide(ControllerStorage.layer))
)
