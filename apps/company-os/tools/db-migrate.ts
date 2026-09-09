import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Option, Redacted } from "effect"
import { Client } from "pg"

import {
  applyMigrations,
  ensureDatabaseSchema,
} from "#/app/server/database/migrations.ts"
import * as Postgres from "#/app/server/database/postgres.ts"
import { localConfigLayer } from "#/app/server/local-config.ts"
import { seedSystem } from "#/app/server/seeds/seed-system.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { ensureSearchIndex } from "#/runtime/server/storage/search-index.ts"

// Deployment sequencing lives in this application's own scripts, not in any
// platform: the deploy task invokes this tool with --if-configured so the
// same command migrates wherever a database is configured and stays a pure
// build everywhere else.
const skipWhenUnconfigured = process.argv.includes("--if-configured")

// Direct development and administration commands may use the committed local
// defaults. Artifact-only deployment builds must remain unconfigured when the
// host did not inject a database and no local override exists.

const localDatabaseHosts = new Set(["127.0.0.1", "[::1]", "localhost"])

const ensureLocalDatabase = Effect.fn("@company/ensureLocalDatabase")(
  function* (databaseUrl: string) {
    const { databaseName, target } = yield* Effect.try({
      try: () => {
        const parsedTarget = new URL(databaseUrl)
        const parsedDatabaseName = decodeURIComponent(
          parsedTarget.pathname.slice(1)
        )
        if (parsedDatabaseName.length === 0) {
          throw new Error("DATABASE_URL must include a database name.")
        }
        return { databaseName: parsedDatabaseName, target: parsedTarget }
      },
      catch: (cause) =>
        cause instanceof Error
          ? cause
          : new Error("DATABASE_URL must be a valid URL.", { cause }),
    })
    if (
      localDatabaseHosts.has(target.hostname) &&
      databaseName !== "postgres"
    ) {
      const adminUrl = new URL(target)
      adminUrl.pathname = "/postgres"
      yield* Effect.tryPromise({
        try: async () => {
          const client = new Client({
            connectionString: adminUrl.toString(),
            connectionTimeoutMillis: 5_000,
          })
          try {
            await client.connect()
            const existing = await client.query<{ exists: boolean }>(
              "select exists(select from pg_database where datname = $1)",
              [databaseName]
            )
            if (!existing.rows[0]?.exists) {
              const identifier = `"${databaseName.replaceAll('"', '""')}"`
              await client.query(`create database ${identifier}`)
              console.log(
                `Created local PostgreSQL database '${databaseName}'.`
              )
            }
          } finally {
            await client.end().catch(() => undefined)
          }
        },
        catch: (cause) =>
          new Error(
            "Could not create the local PostgreSQL database. Ensure DATABASE_URL includes any required username and password, reaches PostgreSQL, and uses a role that can create the database.",
            { cause }
          ),
      })
    }
  }
)

const migrate = Effect.gen(function* () {
  yield* ensureDatabaseSchema()
  yield* applyMigrations()
  yield* seedSystem()
  yield* ensureSearchIndex(
    yield* Database,
    yield* ModelContext,
    process.argv.includes("--rebuild-search")
  )
  yield* Effect.log("Database migrated and required records ensured.")
}).pipe(Effect.provide(Postgres.databaseAndClientLayer))

Effect.gen(function* () {
  const databaseUrl = yield* Config.option(Config.redacted("DATABASE_URL"))
  if (Option.isNone(databaseUrl) && skipWhenUnconfigured) {
    yield* Effect.log("DATABASE_URL is not configured; skipping migrations.")
    return
  }
  if (Option.isSome(databaseUrl)) {
    yield* ensureLocalDatabase(Redacted.value(databaseUrl.value))
  }
  yield* migrate
}).pipe(
  // Deployments pass --if-configured and must not inherit development defaults.
  Effect.provide(localConfigLayer({ development: !skipWhenUnconfigured })),
  NodeRuntime.runMain
)
