import * as Statement from "effect/unstable/sql/Statement"

/** A model-owned physical column; fragments use the driver's identifier escaping. */
export interface Column<A = unknown> extends Statement.Fragment {
  readonly name: string
  readonly type: string
  readonly valueType?: A
}
export type Table<Row extends object = Record<string, unknown>> =
  Statement.Fragment & {
    readonly name: string
    readonly columns: { readonly [K in keyof Row]: Column<Row[K]> }
    readonly ddl: ReadonlyArray<string>
  }

/** SQL expressions in defaults and constraints are trusted, source-owned DDL. */
export interface ColumnDefinition {
  readonly type: string
  readonly nullable?: boolean
  readonly default?: string | undefined
  readonly description?: string | undefined
}

export const tableName = (table: Table<object>) => table.name
export const tableColumns = <T extends Table<object>>(
  table: T
): T["columns"] & Readonly<Record<string, Column>> =>
  // Column descriptors are generated for every key; dynamic lookups may be absent.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  table.columns as T["columns"] & Readonly<Record<string, Column>>

export function snakeCase(value: string): string {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll(/[^a-zA-Z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .toLowerCase()
}
export const quoteIdentifier = (value: string) =>
  `"${value.replaceAll('"', '""')}"`
export const quoteLiteral = (value: string) =>
  `'${value.replaceAll("'", "''")}'`

/** Prefix every wrapped line so multiline descriptions always remain SQL comments. */
function sqlComment(text: string, width = 78): string {
  return text
    .split(/\r?\n/)
    .map((paragraph) => {
      const lines: string[] = []
      let line = "--"
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        if (line.length > 2 && line.length + word.length + 1 > width) {
          lines.push(line)
          line = "--"
        }
        line += ` ${word}`
      }
      return [...lines, line].join("\n")
    })
    .join("\n")
}

export function schemaSection(title: string, description?: string): string {
  const rule = `-- ${"=".repeat(75)}`
  return [
    rule,
    sqlComment(title),
    rule,
    ...(description ? [sqlComment(description)] : []),
  ].join("\n")
}

/** One physical declaration supplies SQL identifiers, write codecs, and CREATE TABLE DDL. */
export function defineTable<Row extends object>(
  name: string,
  fields: { readonly [K in keyof Row]: ColumnDefinition },
  options: {
    readonly description?: string | undefined
    readonly constraints?: ReadonlyArray<string>
  } = {}
): Table<Row> {
  const definitions = Object.entries<ColumnDefinition>(fields)
  const names = definitions.map(([key]) => snakeCase(key))
  if (new Set(names).size !== names.length)
    throw new Error(`Table '${name}' contains duplicate physical column names.`)
  const columns = Object.fromEntries(
    definitions.map(([key, definition]) => [
      key,
      {
        ...Statement.fragment([
          Statement.identifier(name),
          Statement.literal("."),
          Statement.identifier(snakeCase(key)),
        ]),
        name: snakeCase(key),
        type: definition.type,
      },
    ])
  )
  const entries = definitions.map(([key, field]) => {
    const column = `${quoteIdentifier(snakeCase(key))} ${field.type}${field.nullable ? "" : " not null"}${field.default === undefined ? "" : ` default ${field.default}`}`
    return field.description
      ? `${sqlComment(field.description, 76).replaceAll("\n", "\n  ")}\n  ${column}`
      : column
  })
  entries.push(...(options.constraints ?? []))
  const ddl = [
    ...(options.description ? [sqlComment(options.description)] : []),
    `create table ${quoteIdentifier(name)} (\n  ${entries.join(",\n  ")}\n)`,
  ]
  // Every input field produces one column; the row type is the caller's storage contract.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return Object.assign(Statement.fragment([Statement.identifier(name)]), {
    name,
    columns,
    ddl,
  }) as unknown as Table<Row>
}
