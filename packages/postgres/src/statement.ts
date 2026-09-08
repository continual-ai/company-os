import * as Statement from "effect/unstable/sql/Statement"

import { tableColumns, type Column, type Table } from "#/table.ts"

type Input<A> = A extends string ? string : A

/** Projection annotations only; joins do not infer nullability and rows still need boundary decoding. */
export type SelectionRow<S> = {
  [K in keyof S]: S[K] extends SqlValue<infer A> ? A : unknown
}
export type TableRow<T> = T extends Table<infer R> ? R : never
export type SqlValue<A> = Statement.Fragment & { readonly valueType?: A }
/** Annotates a SQL expression; this does not decode its result at runtime. */
export const sqlValue = <A>(fragment: Statement.Fragment): SqlValue<A> =>
  fragment

/** Column aliases preserve model field names without transforming nested JSON keys. */
export function projection(
  selection: Readonly<Record<string, Statement.Fragment>>
): Statement.Fragment {
  return Statement.csv(
    Object.entries(selection).map(([key, value]) =>
      Statement.fragment([
        ...value.segments,
        Statement.literal(" as "),
        Statement.identifier(key),
      ])
    )
  )
}
export const tableProjection = <R extends object>(table: Table<R>) =>
  projection(tableColumns(table))

/** Field codecs are derived once from physical storage; JSON arrays never become PostgreSQL arrays. */
function encodeRow<R extends object>(
  table: Table<R>,
  row: { [K in keyof R]?: Input<NoInfer<R[K]>> | Statement.Fragment }
): Record<string, unknown> {
  const columns = tableColumns(table)
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => {
      const column = columns[key]
      if (!column) throw new Error(`Unknown storage field '${key}'.`)
      return [
        column.name,
        column.type === "jsonb" &&
        value !== null &&
        !Statement.isFragment(value)
          ? JSON.stringify(value)
          : value,
      ]
    })
  )
}

export function conflictColumns(
  sql: Statement.Constructor,
  columns: Column | ReadonlyArray<Column>
): Statement.Fragment {
  return sql.csv(
    (Array.isArray(columns) ? columns : [columns]).map(
      (column) => sql`${sql(column.name)}`
    )
  )
}
export function inValues(
  sql: Statement.Constructor,
  column: Statement.Fragment,
  values: ReadonlyArray<unknown>,
  negated = false
): Statement.Fragment {
  if (values.length === 0) return sql.literal(negated ? "true" : "false")
  return negated
    ? sql`${column} not in ${sql.in(values)}`
    : sql`${column} in ${sql.in(values)}`
}

/** Native write fragments preserve SQL expressions such as etag increments and clock_timestamp(). */
export function assignments<R extends object>(
  sql: Statement.Constructor,
  table: Table<R>,
  values: { [K in keyof R]?: Input<NoInfer<R[K]>> | Statement.Fragment }
) {
  return sql.csv(
    Object.entries(encodeRow(table, values)).map(
      ([key, value]) => sql`${sql(key)} = ${value}`
    )
  )
}
export function insertValues<R extends object>(
  sql: Statement.Constructor,
  table: Table<R>,
  values:
    | { [K in keyof R]?: Input<NoInfer<R[K]>> | Statement.Fragment }
    | ReadonlyArray<{
        [K in keyof R]?: Input<NoInfer<R[K]>> | Statement.Fragment
      }>
) {
  const rows = (Array.isArray(values) ? values : [values]).map((row) =>
    encodeRow(table, row)
  )
  if (rows.length === 0) throw new Error("Cannot insert an empty batch.")
  const keys = [...new Set(rows.flatMap(Object.keys))]
  if (keys.length === 0) return sql`default values`
  const columns = sql.csv(keys.map((key) => sql`${sql(key)}`))
  const tuples = rows.map((row) => {
    const fields = keys.map(
      (key) =>
        sql`${row[key] === undefined ? sql.literal("default") : row[key]}`
    )
    return sql`(${sql.csv(fields)})`
  })
  return sql`(${columns}) values ${sql.csv(tuples)}`
}
