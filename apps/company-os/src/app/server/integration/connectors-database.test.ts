import { Effect, Layer } from "effect"
import { expect } from "vitest"

import { Model } from "#/app.model.ts"
import { testApplication } from "#/app/server/test-application.ts"
import { HttpTransport } from "#/app/server/transport/http-transport.ts"
import {
  GitHubConnector,
  GitHubClients,
} from "#/modules/engineering/server/github-connector.ts"
import { githubDiscovery } from "#/modules/engineering/server/github-discovery.ts"
import { createEffectClient } from "#/runtime/client/create-client.ts"
import { describeModel } from "#/runtime/model/index.ts"
import { Connection } from "#/runtime/platform/model/connection.ts"
import {
  Connector,
  connectorAlias,
} from "#/runtime/platform/model/connector.ts"
import { PlatformModel } from "#/runtime/platform/model/index.ts"
import { moduleAlias } from "#/runtime/platform/model/module-setting.ts"
import { seedModuleSettings } from "#/runtime/platform/server/seed.ts"
import { syncConnectors } from "#/runtime/platform/server/sync-connectors.ts"
import { IdentityProvider } from "#/runtime/server/auth/identity-provider.ts"
import { Database } from "#/runtime/server/index.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"

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
  "Platform exposes a read-only connector catalog and protected, linked connection CRUD",
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
        yield* anonymous.connector.list({}).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      expect(
        yield* anonymous.connection.list({}).pipe(Effect.flip)
      ).toMatchObject({ status: "UNAUTHENTICATED" })
      const catalog = yield* client.connector.list({ expand: { module: true } })
      expect(catalog.items).toHaveLength(1)
      const github = catalog.items[0]!
      expect(github).toMatchObject({
        name: "GitHub",
        definitionId: "github",
        authentication: "token",
        available: true,
        links: { module: { moduleId: "engineering" } },
      })
      expect(client.connector).not.toHaveProperty("create")
      expect(client.connector).not.toHaveProperty("update")
      expect(client.connector).not.toHaveProperty("delete")
      const rejected = yield* http.handle(
        new Request(`http://company.test/api/v1/connectors/${github.id}`, {
          method: "PATCH",
          headers: {
            "x-test-user": "owner",
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "Changed" }),
        })
      )
      expect(rejected.status).toBeGreaterThanOrEqual(400)
      const connection = yield* client.connection.create({
        account: "example",
        token: "private-test-token",
        links: { connector: github.id },
      })
      expect(connection.token).toEqual({ hint: null })
      expect(JSON.stringify(connection)).not.toContain("private-test-token")
      expect(
        yield* client.connection.get({
          id: connection.id,
          expand: { connector: true },
        })
      ).toMatchObject({ links: { connector: { id: github.id } } })
      expect(
        yield* client.connector.get({
          id: github.id,
          expand: { connections: true },
        })
      ).toMatchObject({
        links: {
          connections: {
            totalSize: 1,
            totalSizeExact: true,
            items: [{ id: connection.id }],
          },
        },
      })
      const missingConnector = yield* http.handle(
        new Request("http://company.test/api/v1/connections", {
          method: "POST",
          headers: {
            "x-test-user": "owner",
            "content-type": "application/json",
          },
          body: JSON.stringify({ account: "orphan" }),
        })
      )
      expect(missingConnector.status).toBe(400)
      yield* client.moduleSetting.setEnabled({
        moduleId: "engineering",
        enabled: false,
      })
      expect((yield* client.connection.get({ id: connection.id })).id).toBe(
        connection.id
      )
      expect(
        yield* GitHubConnector.client(connection.id).pipe(
          Effect.provide(GitHubClients.layer),
          Effect.flip
        )
      ).toMatchObject({ _tag: "ConnectionError", reason: "disabled" })
      const metadata = describeModel(Model)
      expect(
        metadata.modules.find((module) => module.id === "platform")?.objectIds
      ).toEqual(expect.arrayContaining(["connector", "connection"]))
      expect(
        metadata.modules.find((module) => module.id === "engineering")
          ?.objectIds
      ).not.toContain("connection")
      expect(metadata.connectors.map((connector) => connector.id)).toEqual([
        "github",
      ])
    })
)

application.test(
  "clients reject another connector before accessing credentials, and discovery ignores unrelated connections",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const other = yield* database.repository(Connector).create({
        definitionId: "other",
        name: "Other",
        description: "Other provider",
        authentication: "token",
        available: true,
        links: { module: moduleAlias("engineering") },
      })
      const connection = yield* database.repository(Connection).create({
        account: "example",
        links: { connector: other.id },
      })
      expect(
        yield* GitHubConnector.client(connection.id).pipe(
          Effect.provide(GitHubClients.layer),
          Effect.flip
        )
      ).toMatchObject({ _tag: "ConnectionError", reason: "connectorMismatch" })
      yield* githubDiscovery
        .reconcile(connection.id)
        .pipe(Effect.provide(GitHubClients.layer))
      expect(
        (yield* database.repository(Connection).get({ id: connection.id })).etag
      ).toBe(connection.etag)
    })
)

application.test(
  "catalog reconciliation preserves connections and marks removed providers unavailable",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const github = yield* database
        .repository(Connector)
        .get({ id: connectorAlias("github") })
      const connection = yield* database.repository(Connection).create({
        account: "example",
        token: "private-test-token",
        links: { connector: github.id },
      })
      yield* syncConnectors().pipe(
        Effect.provide(ModelContext.layer(PlatformModel))
      )
      expect(
        (yield* database.repository(Connector).get({ id: github.id })).available
      ).toBe(false)
      expect(
        (yield* database.repository(Connection).get({ id: connection.id }))
          .token
      ).toEqual({ hint: null })
      yield* seedModuleSettings()
      expect(
        (yield* database.repository(Connector).get({ id: github.id })).available
      ).toBe(true)
      expect(
        (yield* database.repository(Connection).get({ id: connection.id })).id
      ).toBe(connection.id)
    })
)
