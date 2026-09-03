import { randomUUID } from "node:crypto"

import { PgClient } from "@effect/sql-pg"
import { Config, Data, Effect, Layer, Redacted } from "effect"
import { Client } from "pg"

import { Database } from "./database"
import { applyMigrations } from "./migrations"

const defaultAdminUrl = "postgresql://localhost:5432/postgres"

export interface TestDatabaseTemplate {
  readonly adminUrl: string
  readonly databaseName: string
}

declare module "vitest" {
  export interface ProvidedContext {
    readonly testDatabaseTemplate: TestDatabaseTemplate
  }
}

class TestDatabaseError extends Data.TaggedError("TestDatabaseError")<{
  readonly cause: unknown
  readonly message: string
}> {}

function databaseCreationError(cause: unknown): TestDatabaseError {
  return new TestDatabaseError({
    cause,
    message:
      "Could not create an isolated PostgreSQL test database. Ensure DATABASE_URL includes any required username and password, reaches PostgreSQL, and uses a role with CREATEDB.",
  })
}

function databaseName(kind: "database" | "template"): string {
  const id = randomUUID().replaceAll("-", "").slice(0, 20)
  return `company_os_test_${kind}_${id}`
}

function databaseUrl(adminUrl: string, name: string): string {
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}

function quotedIdentifier(identifier: string): string {
  if (
    !/^company_os_test_(?:database|template)_[a-f0-9]{20}$/.test(identifier)
  ) {
    throw new Error(`Invalid generated test database name '${identifier}'.`)
  }
  return `"${identifier}"`
}

function quotedTemplateIdentifier(identifier: string): string {
  return identifier === "template0"
    ? `"template0"`
    : quotedIdentifier(identifier)
}

async function withAdminClient<A>(
  adminUrl: string,
  use: (client: Client) => Promise<A>
): Promise<A> {
  // This client is test-harness control-plane access only; application queries use Database.
  const client = new Client({
    connectionString: adminUrl,
    connectionTimeoutMillis: 5_000,
  })
  try {
    await client.connect()
    return await use(client)
  } finally {
    await client.end().catch(() => undefined)
  }
}

async function createDatabase(
  adminUrl: string,
  name: string,
  template: string
): Promise<void> {
  await withAdminClient(adminUrl, async (client) => {
    await client.query(
      `create database ${quotedIdentifier(name)} template ${quotedTemplateIdentifier(template)}`
    )
  })
}

async function dropDatabase(adminUrl: string, name: string): Promise<void> {
  await withAdminClient(adminUrl, async (client) => {
    await client.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [name]
    )
    await client.query(`drop database if exists ${quotedIdentifier(name)}`)
  })
}

function postgresDatabaseLayer(url: string) {
  return Database.layer.pipe(
    Layer.provide(
      PgClient.layer({
        applicationName: "company-os-test",
        connectTimeout: "5 seconds",
        maxConnections: 10,
        url: Redacted.make(url),
      })
    )
  )
}

async function migrateDatabase(url: string): Promise<void> {
  await Effect.runPromise(
    Effect.scoped(
      applyMigrations().pipe(Effect.provide(postgresDatabaseLayer(url)))
    )
  )
}

async function createTemplate(): Promise<TestDatabaseTemplate> {
  const adminUrl = await Effect.runPromise(
    Config.string("DATABASE_URL").pipe(Config.withDefault(defaultAdminUrl))
  )
  const name = databaseName("template")
  try {
    await createDatabase(adminUrl, name, "template0")
  } catch (cause) {
    throw databaseCreationError(cause)
  }
  try {
    await migrateDatabase(databaseUrl(adminUrl, name))
  } catch (error) {
    await dropDatabase(adminUrl, name)
    throw error
  }
  return { adminUrl, databaseName: name }
}

function layer(template: TestDatabaseTemplate) {
  return Layer.unwrap(
    Effect.acquireRelease(
      Effect.tryPromise({
        try: async () => {
          const name = databaseName("database")
          await createDatabase(template.adminUrl, name, template.databaseName)
          return {
            name,
            url: databaseUrl(template.adminUrl, name),
          }
        },
        catch: databaseCreationError,
      }),
      ({ name }) =>
        Effect.tryPromise({
          try: () => dropDatabase(template.adminUrl, name),
          catch: (cause) =>
            new TestDatabaseError({
              cause,
              message: `Could not remove isolated PostgreSQL test database '${name}'.`,
            }),
        }).pipe(Effect.orDie)
    ).pipe(Effect.map(({ url }) => postgresDatabaseLayer(url)))
  )
}

export const TestDatabase = {
  createTemplate,
  drop: (template: TestDatabaseTemplate) =>
    dropDatabase(template.adminUrl, template.databaseName),
  layer,
} as const
