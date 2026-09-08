import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"

import { schemaHash } from "@company/runtime/server/migrations"

import { schemaSql } from "#/server/database/schema.ts"

const target = fileURLToPath(new URL("../schema.sql", import.meta.url))
const baseline = fileURLToPath(
  new URL("../src/server/database/migrations/0001-initial.ts", import.meta.url)
)
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== schemaSql)
    throw new Error(
      "schema.sql differs from the model. Run pnpm --filter company-os db:generate."
    )
  const { migrations } = await import("#/server/database/migrations/index.ts")
  if (migrations.at(-1)?.schemaHash !== schemaHash(schemaSql))
    throw new Error(
      "The migration sequence does not reach the current schema. Regenerate the disposable baseline or add a migration for retained data."
    )
} else {
  writeFileSync(target, schemaSql)
  if (process.argv.includes("--baseline")) {
    const sql =
      schemaSql +
      "\ninsert into event_journal_state (id, position) values (1, 0);\n"
    writeFileSync(
      baseline,
      `// Generated disposable template baseline. Applied migrations must never be rewritten.\nexport const initialMigration = ${JSON.stringify({ id: 1, name: "initial", sql, schemaHash: schemaHash(schemaSql) }, null, 2)} as const\n`
    )
  }
}
