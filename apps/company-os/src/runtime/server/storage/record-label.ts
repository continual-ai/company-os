import type { Constructor } from "effect/unstable/sql/Statement"

import type { ObjectType, ModelCatalog } from "#/runtime/model/index.ts"
import { relationalQuery } from "#/runtime/server/storage/relational-query.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import { tableColumns } from "#/runtime/server/storage/table.ts"

/** Read current related values in the same statement; no stored copies or per-record hydration calls. */
export function recordLabelSql(
  sql: Constructor,
  storage: PostgresStorage<ModelCatalog>,
  object: ObjectType
) {
  const columns = tableColumns(storage.objects[object.id]!)
  const relations = relationalQuery(sql, storage, object, columns.id)
  const fields = (object.display.titleFields ?? [object.display.title]).map(
    (path) => {
      const value = path.includes(".")
        ? relations.field(path).column
        : columns[path]!
      return sql`nullif(${value}::text, '')`
    }
  )
  return sql`coalesce(nullif(concat_ws(' · ', ${sql.csv(fields)}), ''), ${columns.id})`
}
