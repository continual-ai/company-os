import { randomUUID } from "node:crypto"

import { Client } from "pg"

import type { SchemaMigration } from "#/runtime/server/migrations.ts"
import {
  readSchemaCatalog,
  type SchemaCatalog,
} from "#/runtime/testing/schema-catalog.ts"

function catalogIdentity(row: SchemaCatalog[keyof SchemaCatalog][number]) {
  return JSON.stringify([
    "table" in row ? row.table : "",
    "column" in row ? row.column : row.name,
  ])
}

/** Stable structural hints, not an inferred data transformation or executable migration. */
function describeSchemaDiff(
  before: SchemaCatalog,
  after: SchemaCatalog
): string[] {
  return (
    [
      "tables",
      "columns",
      "constraints",
      "indexes",
      "functions",
      "triggers",
    ] as const
  ).flatMap((section) => {
    const previous = new Map(
      before[section].map((row) => [catalogIdentity(row), JSON.stringify(row)])
    )
    const desired = new Map(
      after[section].map((row) => [catalogIdentity(row), JSON.stringify(row)])
    )
    return [...new Set([...previous.keys(), ...desired.keys()])]
      .sort()
      .flatMap((key) => {
        const from = previous.get(key)
        const to = desired.get(key)
        return from === to
          ? []
          : [
              ...(from === undefined ? [] : [`${section} - ${from}`]),
              ...(to === undefined ? [] : [`${section} + ${to}`]),
            ]
      })
  })
}

/** Replays history and the desired schema in scratch databases; the configured database is never modified. */
export async function previewMigration(
  databaseUrl: string,
  migrations: ReadonlyArray<SchemaMigration>,
  desiredSql: string
) {
  const adminUrl = new URL(databaseUrl)
  adminUrl.pathname = "/postgres"
  adminUrl.searchParams.set(
    "options",
    `${adminUrl.searchParams.get("options") ?? ""} -csearch_path=public`.trim()
  )
  const admin = new Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5_000,
  })
  const created: string[] = []
  try {
    await admin.connect()
    const catalog = async (sql: string) => {
      const name = `company_os_migration_${randomUUID().replaceAll("-", "")}`
      await admin.query(`create database "${name}" template template0`)
      created.push(name)
      const url = new URL(adminUrl)
      url.pathname = `/${name}`
      const client = new Client({
        connectionString: url.toString(),
        connectionTimeoutMillis: 5_000,
      })
      try {
        await client.connect()
        await client.query("begin")
        await client.query("set local search_path to public")
        if (sql.trim()) await client.query(sql)
        await client.query("commit")
      } finally {
        await client.end()
      }
      return readSchemaCatalog(url.toString())
    }
    const before = await catalog(migrations.map(({ sql }) => sql).join("\n\n"))
    const after = await catalog(desiredSql)
    return describeSchemaDiff(before, after)
  } finally {
    try {
      for (const name of created)
        await admin.query(`drop database "${name}" with (force)`)
    } finally {
      await admin.end()
    }
  }
}

export function migrationDraft(hints: ReadonlyArray<string>): string {
  return [
    "-- Replace the failing placeholder below with reviewed SQL before applying.",
    "-- Compare existing migrations with schema.sql; preserve existing records.",
    "-- Renames and data backfills require the business intent, not just this diff.",
    "--",
    ...(hints.length
      ? hints.map((hint) => `-- ${hint}`)
      : ["-- No structural differences. Describe the data change here."]),
    "",
    "do $$",
    "begin",
    "  raise exception 'Unfinished migration: replace this placeholder with reviewed SQL';",
    "end;",
    "$$;",
    "",
  ].join("\n")
}
