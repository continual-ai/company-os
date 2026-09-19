import { PgClient } from "@effect/sql-pg"
import { Effect, Redacted } from "effect"

const localDatabaseHosts = new Set(["127.0.0.1", "[::1]", "localhost"])

export const ensureLocalDatabase = Effect.fn("@company/ensureLocalDatabase")(
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
      yield* Effect.gen(function* () {
        const sql = yield* PgClient.PgClient
        const [existing] = yield* sql<{ exists: boolean }>`
          select exists(select from pg_database where datname = ${databaseName})`
        if (!existing?.exists) {
          yield* sql`create database ${sql(databaseName)}`
          yield* Effect.logInfo(
            `Created local PostgreSQL database '${databaseName}'.`
          )
        }
      }).pipe(
        Effect.provide(
          PgClient.layerFrom(
            PgClient.makeClient({
              url: Redacted.make(adminUrl.toString()),
              connectTimeout: "5 seconds",
            })
          )
        ),
        Effect.mapError(
          (cause) =>
            new Error(
              "Could not create the local PostgreSQL database. Ensure DATABASE_URL includes any required username and password, reaches PostgreSQL, and uses a role that can create the database.",
              { cause }
            )
        )
      )
    }
  }
)
