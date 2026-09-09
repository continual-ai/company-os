import { writeFileSync } from "node:fs"
import { parseArgs } from "node:util"

import { Config, Effect, Redacted } from "effect"

import {
  migrationDraft,
  previewMigration,
} from "#/app/server/database/migration-diff.ts"
import { migrations } from "#/app/server/database/migrations/index.ts"
import { schemaSql } from "#/app/server/database/schema.ts"
import { localConfigLayer } from "#/app/server/local-config.ts"

const { positionals } = parseArgs({ allowPositionals: true, options: {} })
const [name] = positionals
if (
  positionals.length > 1 ||
  (name !== undefined && !/^[a-z][a-z0-9_]*$/.test(name))
)
  throw new Error(
    "Use pnpm db:migration [name], for example pnpm db:migration add_owner."
  )

const databaseUrl = await Effect.runPromise(
  Config.redacted("DATABASE_URL").pipe(
    Effect.provide(localConfigLayer({ development: true }))
  )
)
const hints = await previewMigration(
  Redacted.value(databaseUrl),
  migrations,
  schemaSql
)
writeFileSync(new URL("../schema.sql", import.meta.url), schemaSql)
if (hints.length === 0 && name === undefined) {
  console.log(
    "No structural differences; no migration created. Supply a name to draft a data-only migration."
  )
} else {
  const number = migrations.length + 1
  if (number > 9999)
    throw new Error("Migration filenames support four-digit numbers.")
  const file = `${String(number).padStart(4, "0")}-${name ?? "schema_change"}.sql`
  writeFileSync(
    new URL(`../src/app/server/database/migrations/${file}`, import.meta.url),
    migrationDraft(hints),
    { flag: "wx" }
  )
  console.log(
    `Created ${file} with ${hints.length} structural diff hints.\nReplace its failing placeholder with reviewed SQL, then run pnpm test:migrations.\nThe local database and existing migration files are unchanged.`
  )
}
