import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Config, Effect, Redacted } from "effect"

import { databaseSchemaConfig } from "#/app/server/database/postgres.ts"
import { localConfigLayer } from "#/app/server/local-config.ts"

Effect.gen(function* () {
  const url = yield* Config.redacted("DATABASE_URL")
  const schema = yield* databaseSchemaConfig
  const target = fileURLToPath(new URL("../schema.actual.sql", import.meta.url))
  yield* Effect.try(() => {
    const connection = new URL(Redacted.value(url))
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PGHOST: connection.hostname.replace(/^\[|\]$/g, "") || "localhost",
      PGPORT: connection.port || "5432",
      PGDATABASE: decodeURIComponent(connection.pathname.slice(1)),
      ...(connection.username && {
        PGUSER: decodeURIComponent(connection.username),
      }),
      ...(connection.password && {
        PGPASSWORD: decodeURIComponent(connection.password),
      }),
    }
    // libpq reads connection parameters from individual PG* variables, not a URI in PGDATABASE.
    for (const [key, value] of connection.searchParams)
      env[key === "application_name" ? "PGAPPNAME" : `PG${key.toUpperCase()}`] =
        value
    const sql = execFileSync(
      "pg_dump",
      [
        "--schema-only",
        "--no-owner",
        "--no-privileges",
        "--no-comments",
        "--no-password",
        `--schema=${schema}`,
        `--exclude-table=${schema}.company_os_migrations`,
      ],
      {
        // Connection details stay out of command-line arguments and logs.
        env,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    writeFileSync(target, sql)
  })
  yield* Effect.log(
    "Wrote schema.actual.sql. Compare it with schema.sql to inspect storage differences."
  )
}).pipe(
  Effect.provide(localConfigLayer({ development: true })),
  NodeRuntime.runMain
)
