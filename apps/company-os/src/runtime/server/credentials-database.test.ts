import { Effect, Redacted, Logger } from "effect"
import { expect, expectTypeOf } from "vitest"

import { modelOperation } from "#/runtime/contract/operation-contract.ts"
import {
  defineAction,
  defineModel,
  defineModule,
  defineObject,
  schema,
  type ObjectRecord,
} from "#/runtime/model/index.ts"
import {
  ModuleSetting,
  PlatformModule,
} from "#/runtime/platform/model/index.ts"
import { Credentials } from "#/runtime/server/credentials.ts"
import { Database } from "#/runtime/server/database.ts"
import { EventJournal } from "#/runtime/server/events/event-journal.ts"
import {
  anonymousInvocation,
  systemInvocation,
} from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { defineModuleServer } from "#/runtime/server/module-server.ts"
import {
  operationsFor,
  OperationExecutor,
} from "#/runtime/server/operation-executor.ts"
import { testFoundation } from "#/runtime/testing/foundation.ts"

const Connection = defineObject({
  id: "secretConnection",
  collection: "secretConnections",
  name: "Connection",
  pluralName: "Connections",
  display: { title: "name" },
  properties: {
    name: schema.string(),
    apiKey: schema.secret({ nullable: true }),
    authentication: schema.discriminatedUnion("type", [
      schema.object({
        type: schema.literal("oauth"),
        clientId: schema.string(),
        clientSecret: schema.secret(),
      }),
      schema.object({ type: schema.literal("none") }),
    ]),
  },
})
const IssueKey = defineAction({
  id: "issueTestKey",
  name: "Issue test key",
  description: "Test explicit sensitive output",
  output: { key: schema.secret() },
})
const SecretModule = defineModule({
  id: "secrets",
  name: "Secrets",
  objects: [Connection],
  actions: [IssueKey],
})
const model = defineModel({
  name: "Secrets",
  modules: [PlatformModule, SecretModule],
})
const server = defineModuleServer(SecretModule, {
  operations: {
    issueTestKey: () => Effect.succeed({ key: "generated-test-only-key" }),
  },
})
const fixture = testFoundation(model, { servers: [server] })
const input = {
  name: "Provider",
  apiKey: "private-api-key",
  authentication: {
    type: "oauth" as const,
    clientId: "client",
    clientSecret: "private-client-secret",
  },
}
expectTypeOf<ObjectRecord<typeof Connection>["apiKey"]>().toEqualTypeOf<{
  readonly hint: string | null
} | null>()

fixture.test(
  "standard CRUD encrypts secrets and exposes presence on every read and event",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const secrets = yield* Credentials
      const api = yield* operationsFor(model)
      const record = yield* api.secretConnection.create(input)
      expect(record.apiKey).toEqual({ hint: null })
      expect(record.authentication).toEqual({
        type: "oauth",
        clientId: "client",
        clientSecret: { hint: null },
      })
      expect(
        Redacted.value((yield* secrets.get(Connection, record.id, "apiKey"))!)
      ).toBe(input.apiKey)
      expect(
        Redacted.value(
          (yield* secrets.get(Connection, record.id, [
            "authentication",
            "clientSecret",
          ]))!
        )
      ).toBe(input.authentication.clientSecret)
      const table = database.table(Connection)
      const raw = yield* database.sql<{
        apiKey: unknown
      }>`select ${table.columns.apiKey} as "apiKey" from ${table} where ${table.columns.id} = ${record.id}`
      expect(JSON.stringify(raw)).not.toContain(input.apiKey)
      expect(raw[0]!.apiKey).toMatchObject({
        version: 1,
        ciphertext: expect.any(String),
      })
      const responses = [
        yield* api.secretConnection.get({ id: record.id }),
        yield* api.secretConnection.list({}),
        yield* api.secretConnection.batchGet({ ids: [record.id] }),
        yield* (yield* EventJournal).list({ type: "secretConnection.created" }),
      ]
      for (const response of responses) {
        expect(JSON.stringify(response)).not.toContain("private-")
        expect(JSON.stringify(response)).not.toContain("ciphertext")
      }
      const updated = yield* api.secretConnection.update({
        id: record.id,
        authentication: { type: "oauth", clientId: "changed" },
      })
      expect(updated.authentication).toEqual({
        type: "oauth",
        clientId: "changed",
        clientSecret: { hint: null },
      })
      expect(
        Redacted.value(
          (yield* secrets.get(Connection, record.id, [
            "authentication",
            "clientSecret",
          ]))!
        )
      ).toBe(input.authentication.clientSecret)
      const replaced = yield* api.secretConnection.update({
        id: record.id,
        apiKey: "replacement",
      })
      expect(replaced.etag).not.toBe(updated.etag)
      expect(
        Redacted.value((yield* secrets.get(Connection, record.id, "apiKey"))!)
      ).toBe("replacement")
      expect(
        (yield* api.secretConnection.update({
          id: record.id,
          apiKey: null,
          authentication: { type: "none" },
        })).apiKey
      ).toBeNull()
      expect(
        yield* secrets.get(Connection, record.id, "apiKey")
      ).toBeUndefined()
      expect(
        yield* secrets.get(Connection, record.id, [
          "authentication",
          "clientSecret",
        ])
      ).toBeUndefined()
    })
)

fixture.test(
  "secret writes roll back, respect etags, and cannot be transplanted or read anonymously",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      const secrets = yield* Credentials
      const repository = database.repository(Connection)
      const record = yield* repository.create(input)
      yield* database
        .transaction(() =>
          repository
            .update({ id: record.id, apiKey: "rollback" })
            .pipe(Effect.andThen(Effect.fail("rollback")))
        )
        .pipe(Effect.flip)
      expect(
        Redacted.value((yield* secrets.get(Connection, record.id, "apiKey"))!)
      ).toBe(input.apiKey)
      yield* repository.update({ id: record.id, name: "Updated" })
      yield* repository
        .update({ id: record.id, etag: record.etag, apiKey: "stale" })
        .pipe(Effect.flip)
      expect(
        Redacted.value((yield* secrets.get(Connection, record.id, "apiKey"))!)
      ).toBe(input.apiKey)
      expect(
        (yield* secrets
          .get(Connection, record.id, "apiKey")
          .pipe(
            Effect.provideService(CurrentInvocation, anonymousInvocation),
            Effect.flip
          ))._tag
      ).toBe("ProjectAccessRequired")
      const other = yield* repository.create(input)
      const table = database.table(Connection)
      yield* database.sql`update ${table} set api_key = (select ${table.columns.apiKey} from ${table} where ${table.columns.id} = ${record.id}) where ${table.columns.id} = ${other.id}`
      expect(
        (yield* secrets.get(Connection, other.id, "apiKey").pipe(Effect.flip))
          ._tag
      ).toBe("CredentialError")
      yield* repository.delete({ id: record.id })
      expect(
        yield* secrets.get(Connection, record.id, "apiKey")
      ).toBeUndefined()
    })
)

fixture.test(
  "explicit secret action outputs reach the caller without appearing in operation logs",
  () =>
    Effect.gen(function* () {
      const database = yield* Database
      yield* database
        .repository(ModuleSetting)
        .create({ moduleId: "secrets", enabled: true })
      const logs: Array<ReturnType<typeof Logger.formatStructured.log>> = []
      const logger = Logger.layer([
        Logger.map(Logger.formatStructured, (entry) => logs.push(entry)),
      ])
      const executor = yield* OperationExecutor
      const result = yield* executor
        .run(systemInvocation, modelOperation(model, "issueTestKey"), {})
        .pipe(Effect.provide(logger))
      expect(result.value).toEqual({ key: "generated-test-only-key" })
      expect(logs).toHaveLength(1)
      expect(JSON.stringify(logs)).not.toContain("generated-test-only-key")
      const created = yield* executor
        .run(
          systemInvocation,
          modelOperation(model, "secretConnection.create"),
          input
        )
        .pipe(Effect.provide(logger))
      expect(created.value).toMatchObject({ apiKey: { hint: null } })
      expect(JSON.stringify(logs)).not.toContain("private-")
      expect(JSON.stringify(created.value)).not.toContain("ciphertext")
    })
)
