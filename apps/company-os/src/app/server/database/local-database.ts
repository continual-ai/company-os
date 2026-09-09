import { Effect } from "effect"
import { Client } from "pg"

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
