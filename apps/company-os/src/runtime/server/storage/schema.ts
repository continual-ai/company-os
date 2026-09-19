import { containsSecret } from "#/runtime/model/definition/schema.ts"
import type {
  AnySchema,
  InferSchema,
  LinkTraversal,
  ModelCatalog,
  ObjectType,
  RecordId,
  RecordIdOf,
} from "#/runtime/model/index.ts"
import {
  foreignKeys,
  linkStorage,
} from "#/runtime/server/storage/link-storage.ts"
import {
  defineTable,
  quoteLiteral as literal,
  quoteIdentifier,
  schemaSection,
  snakeCase,
  tableColumns,
  type ColumnDefinition,
  type Table,
} from "#/runtime/server/storage/table.ts"

type TraversalId<
  M extends ModelCatalog,
  T extends LinkTraversal,
> = T["from"]["kind"] extends "interface"
  ? RecordIdOf<M, M["interfaces"][T["from"]["typeId"]]>
  : RecordId<T["from"]["typeId"]>

type ObjectRow<O extends ObjectType> = {
  readonly id: RecordId<O["id"]>
} & {
  readonly [K in keyof O["properties"]]: InferSchema<O["properties"][K]>
}
/** Typed table projection for custom SQL against one model object. */
export type ObjectTable<O extends ObjectType> = Table<ObjectRow<O>>

export interface PostgresStorage<M extends ModelCatalog> {
  readonly model: M
  readonly objects: {
    readonly [K in keyof M["objects"]]: ObjectTable<M["objects"][K]>
  }
  readonly interfaces: {
    readonly [K in keyof M["interfaces"]]: Table<{
      id: RecordIdOf<M, M["interfaces"][K]>
    }>
  }
  readonly linkTables: {
    readonly [K in keyof M["links"]]: Table<{
      forwardId: TraversalId<M, M["links"][K]["forward"]>
      reverseId: TraversalId<M, M["links"][K]["reverse"]>
    }>
  }
  readonly core: {
    readonly objects: Table<{
      id: string
      objectType: string
      metadata: Readonly<Record<string, string>>
      systemManaged: boolean
      etag: string
      createdAt: string
      updatedAt: string
      createdById: string
      updatedById: string
    }>
    readonly recordAliases: Table<{ alias: string; objectId: string }>
  }
  readonly ddl: ReadonlyArray<string>
}

export const objectUniqueConstraintName = (
  physicalName: string,
  ruleId: string
) => `${physicalName}_${snakeCase(ruleId)}_unique`

function nativeArray(schema: AnySchema): boolean {
  return ["boolean", "decimal", "enum", "number", "string"].includes(
    schema.kind
  )
}
function propertySqlType(property: AnySchema): string {
  if (containsSecret(property)) return "jsonb"
  switch (property.kind) {
    case "boolean":
      return "boolean"
    case "decimal":
      return property.precision === undefined
        ? "numeric"
        : `numeric(${property.precision}${property.scale === undefined ? "" : `, ${property.scale}`})`
    case "number":
      return property.integer ? "integer" : "double precision"
    case "recordId":
    case "enum":
      return "text"
    case "string":
      return property.format === "date"
        ? "date"
        : property.format === "timestamp"
          ? "timestamp with time zone"
          : "text"
    case "array":
      return nativeArray(property.items)
        ? `${propertySqlType(property.items)}[]`
        : "jsonb"
    case "optional":
      return propertySqlType(property.value)
    case "file":
    case "geoPoint":
    case "image":
    case "json":
    case "literal":
    case "map":
    case "media":
    case "money":
    case "struct":
    case "union":
      return "jsonb"
    default:
      throw new Error(
        `Unsupported PostgreSQL schema kind '${String(property)}'.`
      )
  }
}
function defaultSql(type: string, value: unknown, nullable = false): string {
  if (value === null && (type !== "jsonb" || nullable)) return "null"
  if (type === "jsonb") return `${literal(JSON.stringify(value))}::jsonb`
  if (Array.isArray(value))
    return `array[${value.map((v) => defaultSql(type.slice(0, -2), v)).join(", ")}]::${type}`
  return typeof value === "number" || typeof value === "boolean"
    ? String(value)
    : typeof value === "string"
      ? literal(value)
      : (() => {
          throw new Error("Invalid scalar PostgreSQL default.")
        })()
}

/** Compiles the portable model into PostgreSQL tables and documented current-state DDL. */
export function makePostgresSchema<const M extends ModelCatalog>(
  model: M,
  documentation = false
): PostgresStorage<M> {
  const section = (title: string, description?: string) =>
    documentation ? [schemaSection(title, description)] : []
  const q = quoteIdentifier
  const objectTypeIds = Object.keys(model.objects)
  const objectTypeCheck =
    objectTypeIds.length === 0
      ? "false"
      : `"object_type" in (\n    ${objectTypeIds.map(literal).join(",\n    ")}\n  )`
  const core = {
    objects: defineTable(
      "objects",
      {
        id: {
          type: "text",
          description:
            "Stable identity shared by the domain row and its interface memberships.",
        },
        objectType: {
          type: "text",
          description: "Object type declared in the company model.",
        },
        metadata: { type: "jsonb", default: "'{}'" },
        systemManaged: { type: "boolean", default: "false" },
        etag: {
          type: "text",
          default: "'1'",
          description: "Version precondition for optimistic writes.",
        },
        createdAt: { type: "timestamp with time zone", default: "now()" },
        createdById: { type: "text" },
        updatedAt: { type: "timestamp with time zone", default: "now()" },
        updatedById: { type: "text" },
      },
      {
        description:
          "Shared record identity, audit fields, and concurrency state. Domain properties live in their object tables.",
        constraints: [
          'primary key ("id")',
          `constraint "objects_object_type_check" check (${objectTypeCheck})`,
        ],
      }
    ),
    recordAliases: defineTable(
      "record_aliases",
      { alias: { type: "text" }, objectId: { type: "text" } },
      {
        description: "Alternate identifiers resolving to one canonical record.",
        constraints: [
          'primary key ("alias")',
          'foreign key ("object_id") references "objects" ("id") on delete cascade',
        ],
      }
    ),
  }
  const interfaces: Record<string, Table<object>> = {}
  const objects: Record<string, Table<object>> = {}
  const linkTables: Record<string, Table<object>> = {}
  const names = new Set(["objects", "record_aliases"])
  const claim = (name: string) => {
    if (names.has(name))
      throw new Error(`Duplicate PostgreSQL table '${name}'.`)
    names.add(name)
    return name
  }
  const tableFor = (id: string): string => {
    if (model.interfaces[id]) return `interface_${snakeCase(id)}`
    const object = model.objects[id]
    if (!object) throw new Error(`Type '${id}' has no PostgreSQL table.`)
    return snakeCase(object.collection)
  }
  const ddl = [
    ...section("Core record storage"),
    ...core.objects.ddl(documentation),
    'create index "objects_object_type_idx" on "objects" ("object_type")',
    ...core.recordAliases.ddl(documentation),
    'create index "record_aliases_object_id_idx" on "record_aliases" ("object_id")',
    ...section(
      "Interface membership",
      "Each row identifies an implementing record. Properties remain in the domain tables."
    ),
  ]
  const constraints: string[] = []
  const referenceFields = (typeId: string): Record<string, ColumnDefinition> =>
    Object.fromEntries(
      foreignKeys(model, typeId).map(({ storage, link }) => [
        storage.column,
        {
          type: "text",
          nullable: link[storage.side].min === 0,
          description: "Relationship reference.",
        },
      ])
    )
  for (const item of Object.values(model.interfaces)) {
    const table = defineTable(
      claim(tableFor(item.id)),
      { id: { type: "text" }, ...referenceFields(item.id) },
      {
        description: `${item.name} membership (${item.id})${item.description ? `\n${item.description}` : ""}`,
        constraints: [
          'primary key ("id")',
          'foreign key ("id") references "objects" ("id") on delete cascade',
        ],
      }
    )
    interfaces[item.id] = table
    ddl.push(...table.ddl(documentation))
  }
  for (const field of ["created_by_id", "updated_by_id"])
    constraints.push(
      `alter table "objects"\n  add constraint ${q(`objects_${field}_${tableFor(model.actor.id)}_id_fkey`)}\n  foreign key (${q(field)}) references ${q(tableFor(model.actor.id))} ("id")\n  on delete restrict deferrable initially deferred`
    )

  let previousModule: string | undefined
  for (const object of Object.values(model.objects)) {
    const module = Object.values(model.modules).find((item) =>
      item.objects.some((member) => member.id === object.id)
    )
    if (module?.id !== previousModule) {
      ddl.push(...section(`Domain objects: ${module?.name ?? model.name}`))
      previousModule = module?.id
    }
    const fields: Record<string, ColumnDefinition> = {
      id: { type: "text" },
      ...referenceFields(object.id),
    }
    for (const [id, property] of Object.entries(object.properties)) {
      const key = id
      if (Object.hasOwn(fields, key))
        throw new Error(
          `Object '${object.id}' produces duplicate PostgreSQL column '${key}'.`
        )
      const type = propertySqlType(property)
      fields[key] = {
        type,
        nullable: property.nullable,
        default: Object.hasOwn(property, "default")
          ? defaultSql(type, property.default, property.nullable)
          : undefined,
        description:
          property.kind === "recordId"
            ? `References ${tableFor(property.typeId)}.id.${property.description ? `\n${property.description}` : ""}`
            : property.description,
      }
    }
    const table = defineTable(claim(tableFor(object.id)), fields, {
      description: `${object.name} (${object.id})${object.description ? `\n${object.description}` : ""}`,
      constraints: [
        'primary key ("id")',
        'foreign key ("id") references "objects" ("id") on delete cascade',
      ],
    })
    objects[object.id] = table
    const name = q(table.name)
    const columns = tableColumns(table)
    ddl.push(...table.ddl(documentation))

    for (const [rule, check] of Object.entries(object.checks)) {
      const operators = { lt: "<", lte: "<=", gt: ">", gte: ">=" }
      ddl.push(
        `alter table ${name} add constraint ${q(`${table.name}_check_${rule}`)} check (${q(columns[check.left]!.name)} ${operators[check.operator]} ${q(columns[check.right]!.name)})`
      )
    }
    for (const [rule, keys] of Object.entries(object.uniqueBy)) {
      const references = foreignKeys(model, object.id)
      const nativeColumns = keys.map(
        (key) =>
          columns[key]?.name ??
          references.find(
            ({ link, storage }) => link[storage.side].key === key
          )!.storage.column
      )
      const constraint = q(objectUniqueConstraintName(table.name, rule))
      const unique = nativeColumns.map(q).join(", ")
      ddl.push(
        keys.every((key) => object.properties[key] !== undefined)
          ? `create unique index ${constraint} on ${name} (${unique})`
          : `alter table ${name} add constraint ${constraint} unique (${unique}) deferrable initially deferred`
      )
    }
  }
  ddl.push(
    ...section(
      "Relationships",
      "Association pairs and cardinality constraints."
    )
  )
  for (const link of Object.values(model.links)) {
    const table = defineTable(
      claim(`link_${snakeCase(link.id)}`),
      {
        forwardId: {
          type: "text",
          description: `References ${tableFor(link.forward.from.typeId)}.id.`,
        },
        reverseId: {
          type: "text",
          description: `References ${tableFor(link.reverse.from.typeId)}.id.`,
        },
      },
      {
        description: `${link.name} (${link.id})`,
        constraints: [
          'primary key ("forward_id", "reverse_id")',
          `foreign key ("forward_id") references ${q(tableFor(link.forward.from.typeId))} ("id") on delete cascade`,
          `foreign key ("reverse_id") references ${q(tableFor(link.reverse.from.typeId))} ("id") on delete cascade`,
        ],
      }
    )
    linkTables[link.id] = table
    const plan = linkStorage(link)
    if (plan.kind === "foreignKey") {
      const owner = q(tableFor(plan.ownerType))
      const column = q(plan.column)
      const forward = plan.side === "forward" ? '"id"' : column
      const reverse = plan.side === "reverse" ? '"id"' : column
      // Views provide one read vocabulary over native FKs and association tables.
      ddl.push(
        `create view ${q(table.name)} as select ${forward} as forward_id, ${reverse} as reverse_id from ${owner} where ${column} is not null`
      )
      constraints.push(
        `alter table ${owner} add constraint ${q(`${snakeCase(link.id)}_target_fk`)} foreign key (${column}) references ${q(tableFor(plan.targetType))} (id) on delete ${link[plan.side].min === 1 ? "no action" : "set null"} deferrable initially deferred`
      )
      const opposite = link[plan.side === "forward" ? "reverse" : "forward"]
      if (opposite.max === 1)
        constraints.push(
          `alter table ${owner} add constraint ${q(`${snakeCase(link.id)}_target_unique`)} unique (${column}) deferrable initially deferred`
        )
      else
        ddl.push(
          `create index ${q(`${snakeCase(link.id)}_target_idx`)} on ${owner} (${column})`
        )
      continue
    }
    ddl.push(...table.ddl(documentation))

    for (const [side, definition] of [
      ["forward", link.forward],
      ["reverse", link.reverse],
    ] as const)
      ddl.push(
        `create ${definition.max !== 1 ? "" : "unique "}index ${q(`${table.name}_${side}_id_${definition.max !== 1 ? "idx" : "unique"}`)} on ${q(table.name)} (${q(`${side}_id`)})`
      )
  }
  // The closed model supplies every table and its exact physical row type.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return {
    model,
    core,
    objects,
    interfaces,
    linkTables,
    ddl: [
      ...ddl,
      ...section(
        "Cross-table constraints",
        "Declared after all domain tables to support cyclic references."
      ),
      ...constraints,
    ],
  } as unknown as PostgresStorage<M>
}
