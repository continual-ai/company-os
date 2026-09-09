import { createHash, randomUUID } from "node:crypto"

import { PgClient } from "@effect/sql-pg"
import { Config, Data, Effect, Redacted } from "effect"
import { Client } from "pg"

import { pgTypes } from "#/runtime/server/storage/pg-types.ts"

const defaultAdminUrl = "postgresql://localhost:5432/postgres"

export interface TestDatabaseTemplate {
  readonly adminUrl: string
  readonly databaseName: string
  /** Shared templates are keyed by their content and dropped by the global teardown, not per file. */
  readonly shared: boolean
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

/** The same initializer always yields the same template name, so files that share a schema share one template. */
function sharedTemplateName(key: string): string {
  const digest = createHash("sha1").update(key).digest("hex").slice(0, 20)
  return `company_os_test_template_${digest}`
}

async function databaseExists(
  adminUrl: string,
  name: string
): Promise<boolean> {
  return withAdminClient(adminUrl, async (client) => {
    const result = await client.query(
      "select 1 from pg_database where datname = $1",
      [name]
    )
    return result.rowCount === 1
  })
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
  return PgClient.layer({
    types: pgTypes,
    applicationName: "company-os-test",
    connectTimeout: "5 seconds",
    maxConnections: 10,
    url: Redacted.make(url),
  })
}

async function adminUrlFromConfig(): Promise<string> {
  return Effect.runPromise(
    Config.string("DATABASE_URL").pipe(Config.withDefault(defaultAdminUrl))
  )
}

/**
 * Creates a template database. A string initializer, or a function with an
 * explicit `key`, produces a shared template named by its content: the first
 * caller builds it under a staging name and renames it into place, later
 * callers reuse it, and a concurrent builder that loses the rename drops its
 * staging copy. Templates without a key are private to the caller.
 */
async function createTemplate(
  initialize: string | ((url: string) => Promise<void>),
  key: string | undefined = typeof initialize === "string"
    ? initialize
    : undefined
): Promise<TestDatabaseTemplate> {
  const adminUrl = await adminUrlFromConfig()
  const shared = key === undefined ? undefined : sharedTemplateName(key)
  if (shared === undefined)
    return buildTemplate(adminUrl, initialize, undefined)
  // One builder per template: parallel test files wait for the first build
  // instead of each running the schema DDL against PostgreSQL at once.
  return withAdminClient(adminUrl, async (lock) => {
    await lock.query("select pg_advisory_lock(hashtext($1))", [shared])
    try {
      if (await databaseExists(adminUrl, shared))
        return { adminUrl, databaseName: shared, shared: true }
      return await buildTemplate(adminUrl, initialize, shared)
    } finally {
      await lock.query("select pg_advisory_unlock(hashtext($1))", [shared])
    }
  })
}

async function buildTemplate(
  adminUrl: string,
  initialize: string | ((url: string) => Promise<void>),
  shared: string | undefined
): Promise<TestDatabaseTemplate> {
  const staging = databaseName("template")
  try {
    await createDatabase(adminUrl, staging, "template0")
  } catch (cause) {
    throw databaseCreationError(cause)
  }
  try {
    const url = databaseUrl(adminUrl, staging)
    if (typeof initialize === "function") await initialize(url)
    else await withAdminClient(url, (client) => client.query(initialize))
  } catch (error) {
    await dropDatabase(adminUrl, staging)
    throw error
  }
  if (shared === undefined)
    return { adminUrl, databaseName: staging, shared: false }
  const renamed = await withAdminClient(adminUrl, async (client) => {
    await client.query(
      "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
      [staging]
    )
    try {
      await client.query(
        `alter database ${quotedIdentifier(staging)} rename to ${quotedIdentifier(shared)}`
      )
      return true
    } catch (cause) {
      // 42P04: another worker renamed its copy first; theirs is identical.
      if (
        typeof cause === "object" &&
        cause !== null &&
        "code" in cause &&
        cause.code === "42P04"
      )
        return false
      throw cause
    }
  })
  if (!renamed) await dropDatabase(adminUrl, staging)
  return { adminUrl, databaseName: shared, shared: true }
}

/** Removes every test database and template left by this or an earlier run. */
async function dropAll(): Promise<void> {
  const adminUrl = await adminUrlFromConfig()
  const names = await withAdminClient(adminUrl, async (client) => {
    const result = await client.query<{ datname: string }>(
      "select datname from pg_database where datname like 'company_os_test_%'"
    )
    return result.rows.map((row) => row.datname)
  })
  for (const name of names) await dropDatabase(adminUrl, name)
}

export interface TestDatabaseClone {
  readonly adminUrl: string
  readonly name: string
  readonly url: string
}

/** Copies a template into a database the caller owns until `dropClone`. */
async function clone(
  template: TestDatabaseTemplate
): Promise<TestDatabaseClone> {
  const name = databaseName("database")
  try {
    await createDatabase(template.adminUrl, name, template.databaseName)
  } catch (cause) {
    throw databaseCreationError(cause)
  }
  return {
    adminUrl: template.adminUrl,
    name,
    url: databaseUrl(template.adminUrl, name),
  }
}

async function dropClone(database: TestDatabaseClone): Promise<void> {
  await dropDatabase(database.adminUrl, database.name)
}

/** Ledgers and index definitions describe the schema rather than test data and survive a reset. */
const PRESERVED_TABLES = ["company_os_migrations", "search_index_state"]

/**
 * Returns a clone to its post-migration state: every data table is truncated
 * with identities restarted, and the journal position row is restored. Much
 * cheaper than cloning again, which is what makes one clone per file viable.
 */
async function reset(database: TestDatabaseClone): Promise<void> {
  await withAdminClient(database.url, async (client) => {
    const tables = await client.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = current_schema() and tablename <> all($1::text[])",
      [PRESERVED_TABLES]
    )
    if (tables.rowCount === 0) return
    const names = tables.rows.map((row) => `"${row.tablename}"`).join(", ")
    await client.query(`truncate table ${names} restart identity cascade`)
    if (tables.rows.some((row) => row.tablename === "event_journal_state"))
      await client.query(
        "insert into event_journal_state (id, position) values (1, 0)"
      )
  })
}

/** A pooled client for a clone; the pool closes with the scope so the next reset finds no sessions. */
function layer(database: TestDatabaseClone) {
  return postgresDatabaseLayer(database.url)
}

export const TestDatabase = {
  clone,
  createTemplate,
  dropAll,
  dropClone,
  reset,
  url: (template: TestDatabaseTemplate) =>
    databaseUrl(template.adminUrl, template.databaseName),
  /** Private templates drop with their file; shared ones wait for the global teardown. */
  drop: (template: TestDatabaseTemplate) =>
    template.shared
      ? Promise.resolve()
      : dropDatabase(template.adminUrl, template.databaseName),
  layer,
} as const
