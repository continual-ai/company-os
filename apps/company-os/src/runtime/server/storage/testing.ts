import { createHash, randomUUID } from "node:crypto"

import { PgClient } from "@effect/sql-pg"
import { Config, ConfigProvider, Data, Effect, Redacted } from "effect"

import { initialJournalSql } from "#/runtime/server/schema.ts"
import { pgTypes } from "#/runtime/server/storage/pg-types.ts"

const defaultAdminUrl = "postgresql://localhost:5433/postgres"

/** Individual statements or an Effect that prepares a database through its connection URL. */
export type DatabaseInitializer =
  | ReadonlyArray<string>
  | ((url: string) => Effect.Effect<void, unknown>)

interface TestDatabaseTemplate {
  readonly adminUrl: string
  readonly databaseName: string
}

class TestDatabaseError extends Data.TaggedError("TestDatabaseError")<{
  readonly cause: unknown
  readonly message: string
}> {}

const databaseCreationError = (cause: unknown) =>
  new TestDatabaseError({
    cause,
    message:
      "Could not create an isolated PostgreSQL test database. Ensure DATABASE_URL includes any required username and password, reaches PostgreSQL, and uses a role with CREATEDB.",
  })

function runPrefix(runId: string): string {
  if (!/^[a-f0-9]{12}$/.test(runId)) throw new Error("Invalid test run ID.")
  return `company_os_test_${runId}_`
}

const databaseName = (
  kind: "database" | "template",
  key: string = randomUUID()
) =>
  Config.String("COMPANY_OS_TEST_RUN_ID").pipe(
    Effect.map(
      (runId) =>
        `${runPrefix(runId)}${kind}_${createHash("sha1").update(key).digest("hex").slice(0, 20)}`
    ),
    Effect.provideService(
      ConfigProvider.ConfigProvider,
      ConfigProvider.fromEnv()
    )
  )

function assertTestDatabaseName(name: string): string {
  if (
    !/^company_os_test_[a-f0-9]{12}_(?:database|template)_[a-f0-9]{20}$/.test(
      name
    )
  )
    throw new Error(`Invalid generated test database name '${name}'.`)
  return name
}

function databaseUrl(adminUrl: string, name: string): string {
  const url = new URL(adminUrl)
  url.pathname = `/${name}`
  return url.toString()
}

/** A single scoped session for setup and catalog reads; session locks close with it. */
export const testDatabaseClient = (url: string) =>
  PgClient.layerFrom(
    PgClient.makeClient({
      url: Redacted.make(url),
      types: pgTypes,
      applicationName: "company-os-test-setup",
      connectTimeout: "5 seconds",
    })
  )

const createDatabase = (adminUrl: string, name: string, template: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    yield* sql`create database ${sql(assertTestDatabaseName(name))} template ${sql(template === "template0" ? template : assertTestDatabaseName(template))}`
  }).pipe(
    Effect.provide(testDatabaseClient(adminUrl)),
    Effect.mapError(databaseCreationError)
  )

const dropDatabase = (adminUrl: string, name: string) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    yield* sql`drop database if exists ${sql(assertTestDatabaseName(name))} with (force)`
  }).pipe(Effect.provide(testDatabaseClient(adminUrl)))

// Test infrastructure uses process configuration, independent of application overrides under test.
const adminUrlFromConfig = Config.String("DATABASE_URL").pipe(
  Config.withDefault(defaultAdminUrl),
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv())
)

/** One builder per content-addressed template; its scoped session owns the advisory lock. */
const createTemplate = Effect.fn("@company/TestDatabase.createTemplate")(
  function* (
    initialize: DatabaseInitializer,
    key: string | undefined = typeof initialize === "function"
      ? undefined
      : JSON.stringify(initialize)
  ) {
    const adminUrl = yield* adminUrlFromConfig
    const name = yield* databaseName("template", key)
    return yield* Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      yield* sql`select pg_advisory_lock(hashtext(${name}))`
      const existing =
        yield* sql`select 1 from pg_database where datname = ${name}`
      if (existing.length === 0) {
        yield* createDatabase(adminUrl, name, "template0")
        const url = databaseUrl(adminUrl, name)
        const initializeDatabase =
          typeof initialize === "function"
            ? initialize(url)
            : Effect.gen(function* () {
                const client = yield* PgClient.PgClient
                for (const statement of initialize) {
                  if (!statement.startsWith("--"))
                    yield* client.unsafe(statement)
                }
              }).pipe(Effect.provide(testDatabaseClient(url)))
        // Failed initialization must never leave a reusable partial template.
        yield* initializeDatabase.pipe(
          Effect.onError(() => dropDatabase(adminUrl, name).pipe(Effect.orDie))
        )
      }
      return { adminUrl, databaseName: name }
    }).pipe(Effect.provide(testDatabaseClient(adminUrl)))
  }
)

/** Removes only the templates and clones owned by one test run. */
const dropAll = (runId: string) =>
  Effect.gen(function* () {
    const prefix = runPrefix(runId)
    const adminUrl = yield* adminUrlFromConfig
    const names = yield* Effect.gen(function* () {
      const sql = yield* PgClient.PgClient
      return yield* sql<{
        datname: string
      }>`select datname from pg_database where starts_with(datname, ${prefix})`
    }).pipe(Effect.provide(testDatabaseClient(adminUrl)))
    for (const { datname } of names) yield* dropDatabase(adminUrl, datname)
  })

interface TestDatabaseClone {
  readonly url: string
}

/** Clones live until global teardown; resetting data makes a clone reusable within a test file. */
const clone = Effect.fn("@company/TestDatabase.clone")(function* (
  template: TestDatabaseTemplate
) {
  const name = yield* databaseName("database")
  yield* createDatabase(template.adminUrl, name, template.databaseName)
  return { url: databaseUrl(template.adminUrl, name) }
})

/** Migration history and index definitions survive resets; business rows do not. */
const reset = (database: TestDatabaseClone) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    const tables = yield* sql<{ tablename: string }>`
      select tablename from pg_tables where schemaname = current_schema()
      and tablename not in ('company_os_migrations', 'search_index_state')`
    if (tables.length === 0) return
    yield* sql`truncate table ${sql.csv(tables.map(({ tablename }) => sql`${sql(tablename)}`))} restart identity cascade`
    if (tables.some(({ tablename }) => tablename === "event_journal_state"))
      yield* sql.unsafe(initialJournalSql)
  }).pipe(Effect.provide(testDatabaseClient(database.url)))

export const TestDatabase = {
  clone,
  createTemplate,
  dropAll,
  reset,
  url: (template: TestDatabaseTemplate) =>
    databaseUrl(template.adminUrl, template.databaseName),
  /** Runtime queries use a pool; setup and cleanup use a single scoped session. */
  layer: (database: TestDatabaseClone) =>
    PgClient.layer({
      url: Redacted.make(database.url),
      types: pgTypes,
      applicationName: "company-os-test",
      connectTimeout: "5 seconds",
      maxConnections: 10,
    }),
} as const
