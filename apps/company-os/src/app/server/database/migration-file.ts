import type { SchemaMigration } from "#/runtime/server/migrations.ts"

/** Numbered filenames determine execution order; SQL is passed whole to PostgreSQL. */
export function readMigrationFile(
  file: string,
  source: string
): SchemaMigration {
  const filename = /^(\d{4})-([a-z][a-z0-9_]*)\.sql$/.exec(file)
  if (!filename)
    throw new Error(
      `Invalid migration filename '${file}'; expected 0001-name.sql.`
    )
  if (!source.trim()) throw new Error(`Migration '${file}' has no SQL.`)
  return {
    id: Number(filename[1]),
    name: filename[2]!,
    sql: source,
  }
}
