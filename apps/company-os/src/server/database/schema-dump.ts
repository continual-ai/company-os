import { execFile } from "node:child_process"
import { promisify } from "node:util"

import { assertDatabaseSchemaName } from "./postgres"

const run = promisify(execFile)

/** Dumps the selected schema without data, ownership, grants, or migration bookkeeping. Requires pg_dump on PATH. */
export async function dumpSchema(
  url: string,
  schema = "public"
): Promise<string> {
  assertDatabaseSchemaName(schema)
  const connection = new URL(url)
  const password =
    connection.searchParams.get("password") ??
    decodeURIComponent(connection.password)
  connection.password = ""
  connection.searchParams.delete("password")
  const { stdout } = await run(
    "pg_dump",
    [
      "--schema-only",
      "--no-password",
      "--no-owner",
      "--no-privileges",
      `--dbname=${connection}`,
      `--schema=${schema}`,
      `--exclude-table=${schema}.company_os_migrations`,
    ],
    {
      // Pass the connection password through libpq's environment, not process arguments.
      env: { ...process.env, ...(password ? { PGPASSWORD: password } : {}) },
      timeout: 30_000,
      maxBuffer: 10 * 1024 * 1024,
    }
  )
  // pg_dump emits a fresh psql restriction token each run; it is not schema state.
  return stdout.replace(/^\\(?:un)?restrict .*\n/gm, "")
}
