import {
  MAX_OBJECT_ALIAS_LENGTH,
  type AnySchema,
  type InferSchema,
  type LinkSide,
  type LinkType,
  type Model,
  type ObjectType,
  type RecordId,
  type SchemaDefinition,
} from "@continual/runtime"
import {
  defineRelations,
  getTableColumns,
  sql,
  type AnyRelation,
  type AnyRelations,
  type Many,
  type One,
  type RelationsBuilder,
  type RelationsBuilderColumn,
  type SchemaEntry,
  type SQL,
} from "drizzle-orm"
import {
  type AnyPgColumn,
  type AnyPgTable,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  type ExtraConfigColumn,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  type PgColumnBuilder,
  type PgNumericConfig,
  type PgTableExtraConfigValue,
  pgTableCreator,
  primaryKey,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core"

const pgTable = pgTableCreator((name) => name, "snake_case")
const timestampWithTimezone = customType<{
  data: string
  driverData: string
}>({
  codec: "timestamptz:string",
  dataType: () => "timestamp with time zone",
  fromDriver: (value) => new Date(value).toISOString(),
})

type ObjectPropertyKey<TObject extends ObjectType> =
  keyof TObject["properties"] & string

type PhysicalObjectColumn<TObject extends ObjectType> =
  | "id"
  | `${TObject["parent"]["objectType"]}Id`
  | ObjectPropertyKey<TObject>

type StoredObjectRow<TObject extends ObjectType> = {
  readonly id: RecordId<TObject["id"]>
} & {
  readonly [TKey in `${TObject["parent"]["objectType"]}Id`]: RecordId<
    TObject["parent"]["objectType"]
  >
} & {
  readonly [TKey in ObjectPropertyKey<TObject>]: InferSchema<
    TObject["properties"][TKey]
  >
}

type ObjectTable<TObject extends ObjectType> = AnyPgTable & {
  readonly [TKey in PhysicalObjectColumn<TObject>]: AnyPgColumn
} & {
  readonly $inferSelect: StoredObjectRow<TObject>
}

type ObjectTables<TModel extends Model> = {
  readonly [TObjectType in keyof TModel["objects"]]: ObjectTable<
    TModel["objects"][TObjectType]
  >
}

type InterfaceTables<TModel extends Model> = {
  readonly [TInterfaceType in keyof TModel["interfaces"]]: AnyPgTable & {
    readonly id: AnyPgColumn
    readonly $inferSelect: {
      readonly id: RecordId<TInterfaceType & string>
    }
  }
}

type LinkTable<TLink> =
  TLink extends LinkType<string, infer TFrom, infer TTo>
    ? AnyPgTable & {
        readonly [TKey in `${TFrom["key"]}Id` | `${TTo["key"]}Id`]: AnyPgColumn
      } & {
        readonly $inferSelect: {
          readonly [TKey in `${TFrom["key"]}Id`]: RecordId<TFrom["typeId"]>
        } & {
          readonly [TKey in `${TTo["key"]}Id`]: RecordId<TTo["typeId"]>
        }
      }
    : never

type LinkTables<TModel extends Model> = {
  readonly [
    TLinkId in keyof TModel["links"] as TModel["links"][TLinkId] extends LinkType<
      string,
      infer TFrom,
      infer TTo
    >
      ? TFrom["cardinality"] extends "many"
        ? TTo["cardinality"] extends "many"
          ? TLinkId
          : never
        : never
      : never
  ]: LinkTable<TModel["links"][TLinkId]>
}

type SchemaTables<TModel extends Model> = {
  readonly __objectAliases: CoreTables<TModel>["objectAliases"]
  readonly __objects: CoreTables<TModel>["objects"]
  readonly __roots: CoreTables<TModel>["roots"]
} & InterfaceTables<TModel> &
  ObjectTables<TModel> & {
    readonly [
      TLinkId in keyof LinkTables<TModel> as TLinkId extends string
        ? `__link_${TLinkId}`
        : never
    ]: LinkTables<TModel>[TLinkId]
  }

type RelationForSide<
  TSide extends LinkSide,
  TTarget extends LinkSide,
> = TSide["cardinality"] extends "many"
  ? Many<TTarget["typeId"]>
  : One<
      TTarget["typeId"],
      TSide["cardinality"] extends "zeroOrOne" ? true : false
    >

type NoRelations = Readonly<Record<never, never>>

type RelationsForLink<TTypeId extends string, TLink> =
  TLink extends LinkType<string, infer TFrom, infer TTo>
    ? (TFrom["typeId"] extends TTypeId
        ? { readonly [TKey in TFrom["key"]]: RelationForSide<TFrom, TTo> }
        : NoRelations) &
        (TTo["typeId"] extends TTypeId
          ? { readonly [TKey in TTo["key"]]: RelationForSide<TTo, TFrom> }
          : NoRelations)
    : NoRelations

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type LinkRelations<
  TModel extends Model,
  TTypeId extends string,
> = UnionToIntersection<
  RelationsForLink<TTypeId, TModel["links"][keyof TModel["links"]]>
>

type ModelTypeId<TModel extends Model> =
  | (keyof TModel["interfaces"] & string)
  | (keyof TModel["objects"] & string)

type ModelRelations<TModel extends Model> = {
  readonly [TTableId in keyof SchemaTables<TModel>]: {
    readonly name: TTableId & string
    readonly relations: TTableId extends ModelTypeId<TModel>
      ? LinkRelations<TModel, TTableId & string>
      : NoRelations
    readonly table: SchemaTables<TModel>[TTableId]
  }
}

interface ObjectStorageOverride<TObject extends ObjectType> {
  readonly columns?: Partial<
    Readonly<Record<ObjectPropertyKey<TObject>, () => PgColumnBuilder>>
  >
  readonly indexes?: (
    columns: Readonly<{
      [TKey in PhysicalObjectColumn<TObject>]: ExtraConfigColumn
    }>
  ) => ReadonlyArray<PgTableExtraConfigValue>
}

interface ColumnBuilderRegistry {
  [columnId: string]: PgColumnBuilder
}

export type PostgresStorageOverrides<TModel extends Model> = {
  readonly objects?: {
    readonly [TObjectType in keyof TModel["objects"]]?: ObjectStorageOverride<
      TModel["objects"][TObjectType]
    >
  }
}

function makeCoreTables<const TModel extends Model>(model: TModel) {
  type StoredObjectType = "root" | (keyof TModel["objects"] & string)
  const storedObjectTypes = ["root", ...Object.keys(model.objects)]
  const storedObjectTypeList = sql.join(
    storedObjectTypes.map((objectType) => sql`${objectType}`),
    sql`, `
  )
  const objects = pgTable(
    "objects",
    {
      id: text().primaryKey(),
      objectType: text().$type<StoredObjectType>().notNull(),
      parentId: text().references((): AnyPgColumn => objects.id, {
        onDelete: "restrict",
      }),
      ancestorIds: text()
        .array()
        .notNull()
        .default(sql`'{}'::text[]`),
      annotations: jsonb()
        .$type<Readonly<Record<string, string>>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      etag: text().notNull(),
      createdAt: timestampWithTimezone().notNull(),
      createdById: text().notNull(),
      updatedAt: timestampWithTimezone().notNull(),
      updatedById: text().notNull(),
    },
    (table) => [
      check(
        "objects_object_type_check",
        sql`${table.objectType} in (${storedObjectTypeList})`
      ),
      check(
        "objects_parent_required",
        sql`(${table.objectType} = 'root' and ${table.parentId} is null)
          or (${table.objectType} <> 'root' and ${table.parentId} is not null)`
      ),
      index("objects_object_type_idx").on(table.objectType),
      index("objects_parent_id_idx").on(table.parentId),
      index("objects_ancestor_ids_idx").using("gin", table.ancestorIds),
      uniqueIndex("objects_id_parent_id_unique").on(table.id, table.parentId),
    ]
  )
  const objectAliases = pgTable(
    "object_aliases",
    {
      alias: text().primaryKey(),
      objectId: text()
        .notNull()
        .references(() => objects.id, { onDelete: "cascade" }),
    },
    (table) => [
      check(
        "object_aliases_alias_length_check",
        sql`char_length(${table.alias}) between 1 and ${MAX_OBJECT_ALIAS_LENGTH}`
      ),
      index("object_aliases_object_id_idx").on(table.objectId),
    ]
  )
  const roots = pgTable("roots", {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
  })
  return { objectAliases, objects, roots }
}

type CoreTables<TModel extends Model> = ReturnType<
  typeof makeCoreTables<TModel>
>

export interface PostgresStorage<TModel extends Model> {
  readonly core: CoreTables<TModel>
  readonly interfaces: InterfaceTables<TModel>
  readonly linkTables: LinkTables<TModel>
  readonly model: TModel
  readonly objects: ObjectTables<TModel>
  readonly relations: ModelRelations<TModel>
  readonly schema: SchemaTables<TModel>
}

function snakeCase(value: string): string {
  return value
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll(/[^a-zA-Z0-9]+/g, "_")
    .replaceAll(/^_+|_+$/g, "")
    .toLowerCase()
}

function columnId(table: AnyPgTable): AnyPgColumn {
  const id = getTableColumns(table).id
  if (id === undefined) throw new Error("A model storage table requires an ID.")
  return id
}

function usesJsonColumn(property: AnySchema): boolean {
  switch (property.kind) {
    case "array":
    case "file":
    case "geoPoint":
    case "image":
    case "literal":
    case "map":
    case "media":
    case "money":
    case "struct":
    case "union":
      return true
    case "optional":
      return usesJsonColumn(property.value)
    default:
      return false
  }
}

function jsonDefault(property: AnySchema): SQL {
  const encoded = JSON.stringify(property.default)
  if (encoded === undefined) {
    throw new Error("A JSON property default must be serializable.")
  }
  return sql`${encoded}::jsonb`
}

function baseColumn(property: AnySchema): PgColumnBuilder {
  switch (property.kind) {
    case "boolean":
      return boolean()
    case "decimal":
      const numericConfig: PgNumericConfig<"string"> = { mode: "string" }
      if (property.precision !== undefined) {
        numericConfig.precision = property.precision
      }
      if (property.scale !== undefined) numericConfig.scale = property.scale
      return numeric(numericConfig).$type<string>()
    case "number":
      return property.integer ? integer() : doublePrecision()
    case "recordId":
      return text()
    case "string":
      if (property.format === "date") return date({ mode: "string" })
      if (property.format === "timestamp") {
        return timestampWithTimezone()
      }
      return text()
    case "array":
    case "file":
    case "geoPoint":
    case "image":
    case "literal":
    case "map":
    case "media":
    case "money":
    case "struct":
    case "union":
      return jsonb().$type<unknown>()
    case "enum":
      return text().$type<string>()
    case "optional":
      return baseColumn(property.value)
    default:
      throw new Error("The schema kind is not supported by PostgreSQL.")
  }
}

function configuredColumn(
  property: AnySchema,
  tableForType: (typeId: string) => AnyPgTable
): PgColumnBuilder {
  let column = baseColumn(property)
  const metadata: SchemaDefinition = property
  if (property.kind === "recordId") {
    column = column.references(() => columnId(tableForType(property.typeId)), {
      onDelete: "restrict",
    })
  }
  if (metadata.nullable !== true) column = column.notNull()
  if (Object.hasOwn(metadata, "default")) {
    column = column.default(
      usesJsonColumn(property) ? jsonDefault(property) : metadata.default
    )
  }
  return column
}

type DynamicRelationsBuilder = RelationsBuilder<
  Readonly<Record<string, SchemaEntry>>
>

function relationTable(relations: DynamicRelationsBuilder, tableId: string) {
  const table = relations[tableId]
  if (table === undefined) {
    throw new Error(`Type '${tableId}' does not have a relation table.`)
  }
  return table
}

function relationColumn(
  table: ReturnType<typeof relationTable>,
  columnKey: string
): RelationsBuilderColumn {
  const column = table[columnKey]
  if (column === undefined) {
    throw new Error(`Relation column '${columnKey}' does not exist.`)
  }
  return column
}

function addRelation(
  config: Record<string, Record<string, AnyRelation>>,
  tableId: string,
  key: string,
  relation: AnyRelation
): void {
  const tableConfig = config[tableId] ?? {}
  if (tableConfig[key] !== undefined) {
    throw new Error(`Relation '${tableId}.${key}' is defined more than once.`)
  }
  tableConfig[key] = relation
  config[tableId] = tableConfig
}

function storedLinkSides(link: {
  readonly from: LinkSide
  readonly to: LinkSide
}): readonly [owner: LinkSide, target: LinkSide] | undefined {
  return link.from.cardinality === "many" ? undefined : [link.from, link.to]
}

function makeRelations(
  model: Model,
  schema: Readonly<Record<string, AnyPgTable>>
): AnyRelations {
  return defineRelations(schema, (relations) => {
    const config: Record<string, Record<string, AnyRelation>> = {}

    for (const link of Object.values(model.links)) {
      const storedSides = storedLinkSides(link)
      if (storedSides !== undefined) {
        const [owner, target] = storedSides
        const ownerTable = relationTable(relations, owner.typeId)
        const targetTable = relationTable(relations, target.typeId)
        const ownerColumn = relationColumn(ownerTable, `${owner.key}Id`)
        const targetId = relationColumn(targetTable, "id")
        const ownerFactory = relations.one[target.typeId]
        if (ownerFactory === undefined) {
          throw new Error(`Link '${link.id}' does not have a valid owner.`)
        }
        addRelation(
          config,
          owner.typeId,
          owner.key,
          ownerFactory({
            alias: link.id,
            from: ownerColumn,
            optional: owner.cardinality === "zeroOrOne",
            to: targetId,
          })
        )

        if (target.cardinality === "many") {
          const inverseFactory = relations.many[owner.typeId]
          if (inverseFactory === undefined) {
            throw new Error(`Link '${link.id}' does not have a valid inverse.`)
          }
          addRelation(
            config,
            target.typeId,
            target.key,
            inverseFactory({
              alias: link.id,
              from: targetId,
              to: ownerColumn,
            })
          )
        } else {
          const inverseFactory = relations.one[owner.typeId]
          if (inverseFactory === undefined) {
            throw new Error(`Link '${link.id}' does not have a valid inverse.`)
          }
          addRelation(
            config,
            target.typeId,
            target.key,
            inverseFactory({
              alias: link.id,
              from: targetId,
              optional: target.cardinality === "zeroOrOne",
              to: ownerColumn,
            })
          )
        }
        continue
      }

      const fromTable = relationTable(relations, link.from.typeId)
      const toTable = relationTable(relations, link.to.typeId)
      const junctionId = `__link_${link.id}`
      const junction = relationTable(relations, junctionId)
      const fromId = relationColumn(fromTable, "id")
      const toId = relationColumn(toTable, "id")
      const fromJunctionColumn = relationColumn(junction, `${link.from.key}Id`)
      const toJunctionColumn = relationColumn(junction, `${link.to.key}Id`)
      const fromFactory = relations.many[link.to.typeId]
      const toFactory = relations.many[link.from.typeId]
      if (fromFactory === undefined || toFactory === undefined) {
        throw new Error(`Many-to-many link '${link.id}' is incomplete.`)
      }
      addRelation(
        config,
        link.from.typeId,
        link.from.key,
        fromFactory({
          alias: link.id,
          from: fromId.through(fromJunctionColumn),
          to: toId.through(toJunctionColumn),
        })
      )
      addRelation(
        config,
        link.to.typeId,
        link.to.key,
        toFactory({
          alias: link.id,
          from: toId.through(toJunctionColumn),
          to: fromId.through(fromJunctionColumn),
        })
      )
    }

    return config
  })
}

/** Compiles a portable closed-world model into deterministic Drizzle tables. */
export function makePostgresSchema<const TModel extends Model>(
  model: TModel,
  overrides: PostgresStorageOverrides<TModel> = {}
): PostgresStorage<TModel> {
  const { objectAliases, objects, roots } = makeCoreTables(model)
  const tableOwners = new Map([
    ["object_aliases", "core object aliases"],
    ["objects", "core objects"],
    ["roots", "core roots"],
  ])
  const claimTableName = (tableName: string, owner: string): void => {
    const existingOwner = tableOwners.get(tableName)
    if (existingOwner !== undefined) {
      throw new Error(
        `PostgreSQL table '${tableName}' is required by both ${existingOwner} and ${owner}.`
      )
    }
    tableOwners.set(tableName, owner)
  }

  const interfaceTables: Record<string, AnyPgTable> = {}
  for (const interfaceType of Object.values(model.interfaces)) {
    const tableName = `interface_${snakeCase(interfaceType.id)}`
    claimTableName(tableName, `interface '${interfaceType.id}'`)
    interfaceTables[interfaceType.id] = pgTable(tableName, {
      id: text()
        .primaryKey()
        .references(() => objects.id, { onDelete: "cascade" }),
    })
  }

  const objectTables: Record<string, AnyPgTable> = {}
  const uniqueLinkProperties = new Set(
    Object.values(model.links)
      .filter(
        (link) =>
          link.from.cardinality !== "many" && link.to.cardinality !== "many"
      )
      .map((link) => `${link.from.typeId}.${link.from.key}Id`)
  )
  const tableForType = (typeId: string): AnyPgTable => {
    if (typeId === "root") return roots
    const table = objectTables[typeId] ?? interfaceTables[typeId]
    if (table === undefined) {
      throw new Error(`Type '${typeId}' does not have a storage table.`)
    }
    return table
  }

  for (const object of Object.values(model.objects)) {
    const tableName = snakeCase(object.collection)
    claimTableName(tableName, `object '${object.id}'`)
    const parentColumn = `${object.parent.objectType}Id`
    const objectOverride = overrides.objects?.[object.id]
    const columns: ColumnBuilderRegistry = {
      id: text()
        .primaryKey()
        .references(() => objects.id, { onDelete: "cascade" }),
      [parentColumn]: text()
        .notNull()
        .references(() => columnId(tableForType(object.parent.objectType)), {
          onDelete: "restrict",
        }),
    }
    for (const [propertyId, property] of Object.entries(object.properties)) {
      const override = objectOverride?.columns?.[propertyId]
      if (property.outputOnly && override === undefined) {
        throw new Error(
          `Output-only property '${object.id}.${propertyId}' requires a storage column override.`
        )
      }
      columns[propertyId] =
        override === undefined
          ? configuredColumn(property, tableForType)
          : override()
    }

    objectTables[object.id] = pgTable(tableName, columns, (table) => {
      const constraints: Array<PgTableExtraConfigValue> = [
        index(`${tableName}_${snakeCase(parentColumn)}_idx`).on(
          table[parentColumn]!
        ),
        foreignKey({
          columns: [table.id!, table[parentColumn]!],
          foreignColumns: [objects.id, objects.parentId],
          name: `${tableName}_object_parent_fk`,
        }).onDelete("cascade"),
      ]
      for (const [propertyId, property] of Object.entries(object.properties)) {
        const column = table[propertyId]
        if (column === undefined) continue
        if (property.kind === "recordId") {
          constraints.push(
            index(`${tableName}_${snakeCase(propertyId)}_idx`).on(column)
          )
        }
        if (uniqueLinkProperties.has(`${object.id}.${propertyId}`)) {
          constraints.push(
            uniqueIndex(`${tableName}_${snakeCase(propertyId)}_unique`).on(
              column
            )
          )
        }
      }
      // SAFETY: the table was built immediately above from this object's
      // physical property and parent-column keys. Runtime iteration erases
      // the model registry's per-object generic, so restore only the callback
      // boundary needed to invoke the already type-checked override.
      // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
      const customIndexes = objectOverride?.indexes as unknown as
        | ((
            columns: Readonly<Record<string, ExtraConfigColumn>>
          ) => ReadonlyArray<PgTableExtraConfigValue>)
        | undefined
      const custom = customIndexes?.(table) ?? []
      constraints.push(...custom)
      return constraints
    })
  }

  const linkTables: Record<string, AnyPgTable> = {}
  for (const link of Object.values(model.links)) {
    if (link.from.cardinality !== "many" || link.to.cardinality !== "many") {
      continue
    }
    const tableName = snakeCase(link.id)
    claimTableName(tableName, `link '${link.id}'`)
    const fromColumn = `${link.from.key}Id`
    const toColumn = `${link.to.key}Id`
    linkTables[link.id] = pgTable(
      tableName,
      {
        [fromColumn]: text()
          .notNull()
          .references(() => columnId(tableForType(link.from.typeId)), {
            onDelete: "cascade",
          }),
        [toColumn]: text()
          .notNull()
          .references(() => columnId(tableForType(link.to.typeId)), {
            onDelete: "cascade",
          }),
      },
      (table) => [
        primaryKey({ columns: [table[fromColumn]!, table[toColumn]!] }),
        index(`${tableName}_${snakeCase(fromColumn)}_idx`).on(
          table[fromColumn]!
        ),
        index(`${tableName}_${snakeCase(toColumn)}_idx`).on(table[toColumn]!),
      ]
    )
  }

  const schemaEntries: Array<readonly [string, AnyPgTable]> = [
    ["__objects", objects],
    ["__objectAliases", objectAliases],
    ["__roots", roots],
    ...Object.entries(interfaceTables),
    ...Object.entries(objectTables),
    ...Object.entries(linkTables).map(
      ([linkId, table]) => [`__link_${linkId}`, table] as const
    ),
  ]
  const schema = Object.fromEntries(schemaEntries)
  if (Object.keys(schema).length !== schemaEntries.length) {
    throw new Error("Model type IDs must be unique across storage tables.")
  }

  // SAFETY: every model object and interface was materialized under its
  // validated type ID and each table contains the derived physical columns.
  // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
  return {
    core: { objectAliases, objects, roots },
    interfaces: interfaceTables,
    linkTables,
    model,
    objects: objectTables,
    relations: makeRelations(model, schema),
    schema,
  } as unknown as PostgresStorage<TModel>
}
