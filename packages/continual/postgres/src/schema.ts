import {
  type AnySchema,
  type InferSchema,
  type LinkTraversal,
  type LinkType,
  linkReferenceTraversals,
  type ModelCatalog,
  type ObjectType,
  type RecordId,
  type RecordIdOf,
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

type PhysicalObjectPropertyKey<
  TObject extends ObjectType,
  TKey extends ObjectPropertyKey<TObject>,
> =
  Extract<
    TObject["properties"][TKey],
    { readonly kind: "recordId" }
  > extends never
    ? TKey
    : `${TKey}Id`

type PhysicalObjectPropertyKeys<TObject extends ObjectType> = {
  [TKey in ObjectPropertyKey<TObject>]: PhysicalObjectPropertyKey<TObject, TKey>
}[ObjectPropertyKey<TObject>]

type PhysicalObjectColumn<TObject extends ObjectType> =
  | "id"
  | "parentId"
  | PhysicalObjectPropertyKeys<TObject>

type StoredObjectRow<TObject extends ObjectType> = {
  readonly id: RecordId<TObject["id"]>
  readonly parentId: RecordId<TObject["parent"]["typeId"]>
} & {
  readonly [
    TKey in ObjectPropertyKey<TObject> as PhysicalObjectPropertyKey<
      TObject,
      TKey
    >
  ]: InferSchema<TObject["properties"][TKey]>
}

type ObjectTable<TObject extends ObjectType> = AnyPgTable & {
  readonly [TKey in PhysicalObjectColumn<TObject>]: AnyPgColumn
} & {
  readonly $inferSelect: StoredObjectRow<TObject>
}

type ObjectTables<TModel extends ModelCatalog> = {
  readonly [TObjectType in keyof TModel["objects"]]: ObjectTable<
    TModel["objects"][TObjectType]
  >
}

type TraversalRecordId<
  TModel extends ModelCatalog,
  TTraversal extends LinkTraversal,
> = TTraversal["from"]["kind"] extends "interface"
  ? RecordIdOf<
      TModel,
      TModel["interfaces"][TTraversal["from"]["typeId"] &
        keyof TModel["interfaces"]]
    >
  : RecordId<TTraversal["from"]["typeId"]>

type InterfaceTables<TModel extends ModelCatalog> = {
  readonly [TInterfaceType in keyof TModel["interfaces"]]: AnyPgTable & {
    readonly id: AnyPgColumn
    readonly $inferSelect: {
      readonly id: RecordIdOf<TModel, TModel["interfaces"][TInterfaceType]>
    }
  }
}

type LinkTable<TModel extends ModelCatalog, TLink> =
  TLink extends LinkType<string, infer TForward, infer TReverse>
    ? AnyPgTable & {
        readonly [
          TKey in `${TForward["key"]}Id` | `${TReverse["key"]}Id`
        ]: AnyPgColumn
      } & {
        readonly $inferSelect: {
          readonly [TKey in `${TForward["key"]}Id`]: TraversalRecordId<
            TModel,
            TForward
          >
        } & {
          readonly [TKey in `${TReverse["key"]}Id`]: TraversalRecordId<
            TModel,
            TReverse
          >
        }
      }
    : never

type LinkTables<TModel extends ModelCatalog> = {
  readonly [
    TLinkId in keyof TModel["links"] as TModel["links"][TLinkId] extends LinkType<
      string,
      infer TForward,
      infer TReverse
    >
      ? TForward["cardinality"] extends "many"
        ? TReverse["cardinality"] extends "many"
          ? TLinkId
          : never
        : never
      : never
  ]: LinkTable<TModel, TModel["links"][TLinkId]>
}

type SchemaTables<TModel extends ModelCatalog> = {
  readonly __recordAliases: CoreTables<TModel>["recordAliases"]
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
  TSide extends LinkTraversal,
  TTarget extends LinkTraversal,
> = TSide["cardinality"] extends "many"
  ? Many<TTarget["from"]["typeId"]>
  : One<
      TTarget["from"]["typeId"],
      TSide["cardinality"] extends "zeroOrOne" ? true : false
    >

type NoRelations = Readonly<Record<never, never>>

type RelationsForLink<TTypeId extends string, TLink> =
  TLink extends LinkType<string, infer TForward, infer TReverse>
    ? (TForward["from"]["typeId"] extends TTypeId
        ? {
            readonly [TKey in TForward["key"]]: RelationForSide<
              TForward,
              TReverse
            >
          }
        : NoRelations) &
        (TReverse["from"]["typeId"] extends TTypeId
          ? {
              readonly [TKey in TReverse["key"]]: RelationForSide<
                TReverse,
                TForward
              >
            }
          : NoRelations)
    : NoRelations

type UnionToIntersection<TValue> = (
  TValue extends unknown ? (value: TValue) => void : never
) extends (value: infer TIntersection) => void
  ? TIntersection
  : never

type LinkRelations<
  TModel extends ModelCatalog,
  TTypeId extends string,
> = UnionToIntersection<
  RelationsForLink<TTypeId, TModel["links"][keyof TModel["links"]]>
>

type ModelTypeId<TModel extends ModelCatalog> =
  | (keyof TModel["interfaces"] & string)
  | (keyof TModel["objects"] & string)

type ModelRelations<TModel extends ModelCatalog> = {
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

export type PostgresStorageOverrides<TModel extends ModelCatalog> = {
  readonly objects?: {
    readonly [TObjectType in keyof TModel["objects"]]?: ObjectStorageOverride<
      TModel["objects"][TObjectType]
    >
  }
}

function makeCoreTables<const TModel extends ModelCatalog>(
  model: TModel,
  actorIdColumn: () => AnyPgColumn
) {
  type StoredObjectType =
    | TModel["root"]["id"]
    | (keyof TModel["objects"] & string)
  const storedObjectTypes = [model.root.id, ...Object.keys(model.objects)]
  const storedObjectTypeList = sql.join(
    storedObjectTypes.map((objectType) => sql`${objectType}`),
    sql`, `
  )
  const auditActor = () => {
    // A model whose initial root and actor refer to each other requires these
    // constraints to be DEFERRABLE in the committed SQL migration.
    return text().notNull().references(actorIdColumn, { onDelete: "restrict" })
  }
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
      metadata: jsonb()
        .$type<Readonly<Record<string, string>>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      systemManaged: boolean().notNull().default(false),
      etag: text()
        .default(sql`gen_random_uuid()::text`)
        .notNull(),
      createdAt: timestampWithTimezone()
        .default(sql`now()`)
        .notNull(),
      createdById: auditActor(),
      updatedAt: timestampWithTimezone()
        .default(sql`now()`)
        .notNull(),
      updatedById: auditActor(),
    },
    (table) => [
      check(
        "objects_object_type_check",
        sql`${table.objectType} in (${storedObjectTypeList})`
      ),
      check(
        "objects_parent_required",
        sql`(${table.objectType} = ${model.root.id} and ${table.parentId} is null)
          or (${table.objectType} <> ${model.root.id} and ${table.parentId} is not null)`
      ),
      index("objects_object_type_idx").on(table.objectType),
      index("objects_parent_id_idx").on(table.parentId),
      index("objects_ancestor_ids_idx").using("gin", table.ancestorIds),
      uniqueIndex("objects_id_parent_id_unique").on(table.id, table.parentId),
    ]
  )
  const recordAliases = pgTable(
    "record_aliases",
    {
      alias: text().primaryKey(),
      objectId: text()
        .notNull()
        .references(() => objects.id, { onDelete: "cascade" }),
    },
    (table) => [index("record_aliases_object_id_idx").on(table.objectId)]
  )
  const roots = pgTable("roots", {
    id: text()
      .primaryKey()
      .references(() => objects.id, { onDelete: "cascade" }),
  })
  return { recordAliases, objects, roots }
}

type CoreTables<TModel extends ModelCatalog> = ReturnType<
  typeof makeCoreTables<TModel>
>

export interface PostgresStorage<TModel extends ModelCatalog> {
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

export function physicalPropertyKey(
  propertyId: string,
  property: AnySchema
): string {
  return property.kind === "recordId" ? `${propertyId}Id` : propertyId
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

function makeRelations(
  model: ModelCatalog,
  schema: Readonly<Record<string, AnyPgTable>>
): AnyRelations {
  return defineRelations(schema, (relations) => {
    const config: Record<string, Record<string, AnyRelation>> = {}

    for (const link of Object.values(model.links)) {
      const reference = linkReferenceTraversals(link)
      if (reference !== undefined) {
        const { source, target } = reference
        const ownerTable = relationTable(relations, source.from.typeId)
        const targetTable = relationTable(relations, target.from.typeId)
        const ownerColumn = relationColumn(ownerTable, `${source.key}Id`)
        const targetId = relationColumn(targetTable, "id")
        const ownerFactory = relations.one[target.from.typeId]
        if (ownerFactory === undefined) {
          throw new Error(`Link '${link.id}' does not have a valid owner.`)
        }
        addRelation(
          config,
          source.from.typeId,
          source.key,
          ownerFactory({
            alias: link.id,
            from: ownerColumn,
            optional: source.cardinality === "zeroOrOne",
            to: targetId,
          })
        )

        if (target.cardinality === "many") {
          const inverseFactory = relations.many[source.from.typeId]
          if (inverseFactory === undefined) {
            throw new Error(`Link '${link.id}' does not have a valid inverse.`)
          }
          addRelation(
            config,
            target.from.typeId,
            target.key,
            inverseFactory({
              alias: link.id,
              from: targetId,
              to: ownerColumn,
            })
          )
        } else {
          const inverseFactory = relations.one[source.from.typeId]
          if (inverseFactory === undefined) {
            throw new Error(`Link '${link.id}' does not have a valid inverse.`)
          }
          addRelation(
            config,
            target.from.typeId,
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

      const forwardTable = relationTable(relations, link.forward.from.typeId)
      const reverseTable = relationTable(relations, link.reverse.from.typeId)
      const junctionId = `__link_${link.id}`
      const junction = relationTable(relations, junctionId)
      const forwardId = relationColumn(forwardTable, "id")
      const reverseId = relationColumn(reverseTable, "id")
      const forwardJunctionColumn = relationColumn(
        junction,
        `${link.forward.key}Id`
      )
      const reverseJunctionColumn = relationColumn(
        junction,
        `${link.reverse.key}Id`
      )
      const forwardFactory = relations.many[link.reverse.from.typeId]
      const reverseFactory = relations.many[link.forward.from.typeId]
      if (forwardFactory === undefined || reverseFactory === undefined) {
        throw new Error(`Many-to-many link '${link.id}' is incomplete.`)
      }
      addRelation(
        config,
        link.forward.from.typeId,
        link.forward.key,
        forwardFactory({
          alias: link.id,
          from: forwardId.through(forwardJunctionColumn),
          to: reverseId.through(reverseJunctionColumn),
        })
      )
      addRelation(
        config,
        link.reverse.from.typeId,
        link.reverse.key,
        reverseFactory({
          alias: link.id,
          from: reverseId.through(reverseJunctionColumn),
          to: forwardId.through(forwardJunctionColumn),
        })
      )
    }

    return config
  })
}

/** Compiles a portable closed-world model into deterministic Drizzle tables. */
export function makePostgresSchema<const TModel extends ModelCatalog>(
  model: TModel,
  overrides: PostgresStorageOverrides<TModel> = {}
): PostgresStorage<TModel> {
  const actorInterface = model.actor
  let actorTable: AnyPgTable | undefined
  const actorIdColumn = () => {
    if (actorTable === undefined) {
      throw new Error(
        `Actor interface '${actorInterface.id}' does not have a storage table.`
      )
    }
    return columnId(actorTable)
  }
  const { recordAliases, objects, roots } = makeCoreTables(model, actorIdColumn)
  const tableOwners = new Map([
    ["record_aliases", "core record aliases"],
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
  actorTable = interfaceTables[actorInterface.id]

  const objectTables: Record<string, AnyPgTable> = {}
  const uniqueLinkProperties = new Set(
    Object.values(model.links).flatMap((link) => {
      const reference = linkReferenceTraversals(link)
      if (
        reference !== undefined &&
        reference.source.cardinality !== "many" &&
        reference.target.cardinality !== "many"
      ) {
        return [`${reference.source.from.typeId}.${reference.source.key}`]
      }
      return []
    })
  )
  const tableForType = (typeId: string): AnyPgTable => {
    if (typeId === model.root.id) return roots
    const table = objectTables[typeId] ?? interfaceTables[typeId]
    if (table === undefined) {
      throw new Error(`Type '${typeId}' does not have a storage table.`)
    }
    return table
  }

  for (const object of Object.values(model.objects)) {
    const tableName = snakeCase(object.collection)
    claimTableName(tableName, `object '${object.id}'`)
    const objectOverride = overrides.objects?.[object.id]
    const columns: ColumnBuilderRegistry = {
      id: text()
        .primaryKey()
        .references(() => objects.id, { onDelete: "cascade" }),
      parentId: text().notNull(),
    }
    for (const [propertyId, property] of Object.entries(object.properties)) {
      const override = objectOverride?.columns?.[propertyId]
      if (property.outputOnly && override === undefined) {
        throw new Error(
          `Output-only property '${object.id}.${propertyId}' requires a storage column override.`
        )
      }
      const columnKey = physicalPropertyKey(propertyId, property)
      if (columns[columnKey] !== undefined) {
        throw new Error(
          `Object '${object.id}' properties produce duplicate PostgreSQL column '${columnKey}'.`
        )
      }
      columns[columnKey] =
        override === undefined
          ? configuredColumn(property, tableForType)
          : override()
    }

    objectTables[object.id] = pgTable(tableName, columns, (table) => {
      const constraints: Array<PgTableExtraConfigValue> = [
        index(`${tableName}_parent_id_idx`).on(table.parentId!),
        foreignKey({
          columns: [table.parentId!],
          foreignColumns: [columnId(tableForType(object.parent.typeId))],
          name: `${tableName}_parent_${snakeCase(object.parent.typeId)}_fk`,
        }).onDelete("restrict"),
        foreignKey({
          columns: [table.id!, table.parentId!],
          foreignColumns: [objects.id, objects.parentId],
          name: `${tableName}_object_parent_fk`,
        }).onDelete("cascade"),
      ]
      for (const [propertyId, property] of Object.entries(object.properties)) {
        const columnKey = physicalPropertyKey(propertyId, property)
        const column = table[columnKey]
        if (column === undefined) continue
        if (property.kind === "recordId") {
          constraints.push(
            index(`${tableName}_${snakeCase(columnKey)}_idx`).on(column)
          )
        }
        if (uniqueLinkProperties.has(`${object.id}.${propertyId}`)) {
          constraints.push(
            uniqueIndex(`${tableName}_${snakeCase(columnKey)}_unique`).on(
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
    if (
      link.forward.cardinality !== "many" ||
      link.reverse.cardinality !== "many"
    ) {
      continue
    }
    const tableName = snakeCase(link.id)
    claimTableName(tableName, `link '${link.id}'`)
    const forwardColumn = `${link.forward.key}Id`
    const reverseColumn = `${link.reverse.key}Id`
    linkTables[link.id] = pgTable(
      tableName,
      {
        [forwardColumn]: text()
          .notNull()
          .references(() => columnId(tableForType(link.forward.from.typeId)), {
            onDelete: "cascade",
          }),
        [reverseColumn]: text()
          .notNull()
          .references(() => columnId(tableForType(link.reverse.from.typeId)), {
            onDelete: "cascade",
          }),
      },
      (table) => [
        primaryKey({
          columns: [table[forwardColumn]!, table[reverseColumn]!],
        }),
        index(`${tableName}_${snakeCase(forwardColumn)}_idx`).on(
          table[forwardColumn]!
        ),
        index(`${tableName}_${snakeCase(reverseColumn)}_idx`).on(
          table[reverseColumn]!
        ),
      ]
    )
  }

  const schemaEntries: Array<readonly [string, AnyPgTable]> = [
    ["__objects", objects],
    ["__recordAliases", recordAliases],
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
    core: { recordAliases, objects, roots },
    interfaces: interfaceTables,
    linkTables,
    model,
    objects: objectTables,
    relations: makeRelations(model, schema),
    schema,
  } as unknown as PostgresStorage<TModel>
}
