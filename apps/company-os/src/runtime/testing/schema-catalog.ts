import { Client } from "pg"

/** Structure of one schema as PostgreSQL reports it, independent of the statements that built it. */
export interface SchemaCatalog {
  readonly columns: ReadonlyArray<{
    readonly table: string
    readonly column: string
    readonly type: string
    readonly nullable: boolean
    readonly default: string | null
  }>
  readonly constraints: ReadonlyArray<{
    readonly table: string
    readonly name: string
    readonly definition: string
  }>
  readonly functions: ReadonlyArray<{
    readonly name: string
    readonly definition: string
  }>
  readonly indexes: ReadonlyArray<{
    readonly table: string
    readonly name: string
    readonly definition: string
  }>
  readonly tables: ReadonlyArray<{
    readonly name: string
  }>
  readonly triggers: ReadonlyArray<{
    readonly table: string
    readonly name: string
    readonly definition: string
  }>
}

/**
 * Reads database structure from the system catalogs. Descriptive comments and
 * migration bookkeeping are excluded; documentation changes do not need migrations.
 */
export async function readSchemaCatalog(
  url: string,
  options: {
    readonly schema?: string
    readonly exclude?: ReadonlyArray<string>
  } = {}
): Promise<SchemaCatalog> {
  const schema = options.schema ?? "public"
  const excluded = options.exclude ?? ["company_os_migrations"]
  const client = new Client({
    connectionString: url,
    connectionTimeoutMillis: 5_000,
  })
  await client.connect()
  try {
    const rows = async <T extends object>(
      sql: string,
      parameters: ReadonlyArray<unknown> = [schema, excluded]
    ) => (await client.query<T>(sql, [...parameters])).rows
    // One connection runs one query at a time, so the catalog reads are sequential.
    const tables = await rows<SchemaCatalog["tables"][number]>(`
          select c.relname as name
          from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = $1 and c.relkind = 'r' and c.relname <> all($2::text[])
          order by c.relname`)
    const columns = await rows<SchemaCatalog["columns"][number]>(`
          select c.relname as table, a.attname as column,
            format_type(a.atttypid, a.atttypmod) as type, not a.attnotnull as nullable,
            pg_get_expr(d.adbin, d.adrelid) as default
          from pg_attribute a
          join pg_class c on c.oid = a.attrelid
          join pg_namespace n on n.oid = c.relnamespace
          left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
          where n.nspname = $1 and c.relkind = 'r' and c.relname <> all($2::text[])
            and a.attnum > 0 and not a.attisdropped
          order by c.relname, a.attname`)
    const constraints = await rows<SchemaCatalog["constraints"][number]>(`
          select c.relname as table, k.conname as name, pg_get_constraintdef(k.oid) as definition
          from pg_constraint k
          join pg_class c on c.oid = k.conrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = $1 and c.relname <> all($2::text[])
          order by c.relname, k.conname`)
    const indexes = await rows<SchemaCatalog["indexes"][number]>(`
          select tablename as table, indexname as name, indexdef as definition
          from pg_indexes
          where schemaname = $1 and tablename <> all($2::text[])
          order by tablename, indexname`)
    const triggers = await rows<SchemaCatalog["triggers"][number]>(`
          select c.relname as table, t.tgname as name, pg_get_triggerdef(t.oid) as definition
          from pg_trigger t
          join pg_class c on c.oid = t.tgrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = $1 and not t.tgisinternal and c.relname <> all($2::text[])
          order by c.relname, t.tgname`)
    const functions = await rows<SchemaCatalog["functions"][number]>(
      `
          select p.proname as name, pg_get_functiondef(p.oid) as definition
          from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = $1
          order by p.proname`,
      [schema]
    )
    return { columns, constraints, functions, indexes, tables, triggers }
  } finally {
    await client.end().catch(() => undefined)
  }
}
