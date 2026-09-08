import type {
  AnySchema,
  RecordId,
  RecordIdOf,
  LinkTraversal,
  InferSchema,
  ModelCatalog,
  ObjectType,
} from "#/model/index.ts"
import {
  defineTable,
  tableColumns,
  snakeCase,
  quoteIdentifier,
  quoteLiteral as literal,
  type Table,
  type ColumnDefinition,
} from "#/server/postgres/table.ts"

type TraversalId<
  M extends ModelCatalog,
  T extends LinkTraversal,
> = T["from"]["kind"] extends "interface"
  ? RecordIdOf<M, M["interfaces"][T["from"]["typeId"]]>
  : RecordId<T["from"]["typeId"]>

type ObjectRow<O extends ObjectType> = {
  readonly id: RecordId<O["id"]>
  readonly parentId: RecordId<O["parent"]["typeId"]>
} & {
  readonly [
    K in keyof O["properties"] as O["properties"][K] extends {
      kind: "recordId"
    }
      ? `${K & string}Id`
      : K
  ]: InferSchema<O["properties"][K]>
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
      parentId: string | null
      ancestorIds: ReadonlyArray<string>
      metadata: Readonly<Record<string, string>>
      systemManaged: boolean
      etag: string
      createdAt: string
      updatedAt: string
      createdById: string
      updatedById: string
    }>
    readonly roots: Table<{ id: string }>
    readonly recordAliases: Table<{ alias: string; objectId: string }>
  }
  readonly ddl: ReadonlyArray<string>
}

export const objectUniqueConstraintName = (
  physicalName: string,
  ruleId: string
) => `${physicalName}_${snakeCase(ruleId)}_unique`
export const physicalPropertyKey = (id: string, property: AnySchema) =>
  property.kind === "recordId" ? `${id}Id` : id

function nativeArray(schema: AnySchema): boolean {
  return ["boolean", "decimal", "enum", "number", "string"].includes(
    schema.kind
  )
}
function propertySqlType(property: AnySchema): string {
  switch (property.kind) {
    case "boolean":
      return "boolean"
    case "decimal":
      return property.precision === undefined
        ? "numeric"
        : `numeric(${property.precision}${property.scale === undefined ? "" : `,${property.scale}`})`
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
function defaultSql(type: string, value: unknown): string {
  if (value === null) return "null"
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
  model: M
): PostgresStorage<M> {
  const q = quoteIdentifier
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
        parentId: {
          type: "text",
          nullable: true,
          description: "Ownership parent. Only the root has no parent.",
        },
        ancestorIds: {
          type: "text[]",
          default: "'{}'",
          description:
            "Ownership ancestry used when filtering records by access scope.",
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
          "Shared record identity, ownership, audit fields, and concurrency state. Domain properties live in their object tables.",
        constraints: [
          "primary key (id)",
          "foreign key (parent_id) references objects(id) on delete restrict",
          `constraint objects_object_type_check check (object_type in (${[model.root.id, ...Object.keys(model.objects)].map(literal).join(", ")}))`,
          `constraint objects_parent_required check ((object_type=${literal(model.root.id)} and parent_id is null) or (object_type<>${literal(model.root.id)} and parent_id is not null))`,
          "constraint objects_id_parent_id_unique unique(id,parent_id)",
        ],
      }
    ),
    roots: defineTable(
      "roots",
      { id: { type: "text" } },
      {
        description: "Root membership for the company ownership tree.",
        constraints: [
          "primary key (id)",
          "foreign key (id) references objects(id) on delete cascade",
        ],
      }
    ),
    recordAliases: defineTable(
      "record_aliases",
      { alias: { type: "text" }, objectId: { type: "text" } },
      {
        description: "Alternate identifiers resolving to one canonical record.",
        constraints: [
          "primary key (alias)",
          "foreign key (object_id) references objects(id) on delete cascade",
        ],
      }
    ),
  }
  const interfaces: Record<string, Table<object>> = {}
  const objects: Record<string, Table<object>> = {}
  const linkTables: Record<string, Table<object>> = {}
  const names = new Set(["objects", "roots", "record_aliases"])
  const claim = (name: string) => {
    if (names.has(name))
      throw new Error(`Duplicate PostgreSQL table '${name}'.`)
    names.add(name)
    return name
  }
  const tableFor = (id: string): string => {
    if (id === model.root.id) return "roots"
    if (model.interfaces[id]) return `interface_${snakeCase(id)}`
    const object = model.objects[id]
    if (!object) throw new Error(`Type '${id}' has no PostgreSQL table.`)
    return snakeCase(object.collection)
  }
  const ddl = [
    "-- Core record storage",
    ...core.objects.ddl,
    "create index objects_object_type_idx on objects(object_type)",
    "create index objects_parent_id_idx on objects(parent_id)",
    "create index objects_ancestor_ids_idx on objects using gin(ancestor_ids)",
    ...core.roots.ddl,
    ...core.recordAliases.ddl,
    "create index record_aliases_object_id_idx on record_aliases(object_id)",
    "-- Interface membership: each row identifies an implementing record; no duplicated domain properties",
  ]
  const constraints: string[] = []
  for (const item of Object.values(model.interfaces)) {
    const table = defineTable(
      claim(tableFor(item.id)),
      { id: { type: "text" } },
      {
        description: `Membership in ${item.name} (${item.id}). IDs refer to implementing records; properties remain on their domain tables.${item.description ? ` ${item.description}` : ""}`,
        constraints: [
          "primary key (id)",
          "foreign key (id) references objects(id) on delete cascade",
        ],
      }
    )
    interfaces[item.id] = table
    ddl.push(...table.ddl)
  }
  for (const field of ["created_by_id", "updated_by_id"])
    constraints.push(
      `alter table objects add constraint ${q(`objects_${field}_${tableFor(model.actor.id)}_id_fkey`)} foreign key (${field}) references ${q(tableFor(model.actor.id))}(id) on delete restrict deferrable initially deferred`
    )

  let previousModule: string | undefined
  for (const object of Object.values(model.objects)) {
    const module = Object.values(model.modules).find((item) =>
      item.objects.some((member) => member.id === object.id)
    )
    if (module?.id !== previousModule) {
      ddl.push(`-- Domain objects: ${module?.name ?? model.name}`)
      previousModule = module?.id
    }
    const fields: Record<string, ColumnDefinition> = {
      id: {
        type: "text",
        description: "Same identity as the corresponding row in objects.",
      },
      parentId: {
        type: "text",
        description: `Ownership parent implementing ${object.parent.typeId}.`,
      },
    }
    for (const [id, property] of Object.entries(object.properties)) {
      const key = physicalPropertyKey(id, property)
      if (Object.hasOwn(fields, key))
        throw new Error(
          `Object '${object.id}' produces duplicate PostgreSQL column '${key}'.`
        )
      const type = propertySqlType(property)
      fields[key] = {
        type,
        nullable: property.nullable,
        default: Object.hasOwn(property, "default")
          ? defaultSql(type, property.default)
          : undefined,
        description: property.description,
      }
    }
    const table = defineTable(claim(tableFor(object.id)), fields, {
      description: `${object.name} (${object.id}).${object.description ? ` ${object.description}` : ""}`,
      constraints: [
        "primary key (id)",
        "foreign key (id) references objects(id) on delete cascade",
      ],
    })
    objects[object.id] = table
    const name = q(table.name)
    const columns = tableColumns(table)
    ddl.push(
      ...table.ddl,
      `create index ${q(`${table.name}_parent_id_idx`)} on ${name}(parent_id)`
    )
    for (const [id, property] of Object.entries(object.properties)) {
      if (property.kind !== "recordId") continue
      const column = columns[physicalPropertyKey(id, property)]!
      constraints.push(
        `alter table ${name} add foreign key (${q(column.name)}) references ${q(tableFor(property.typeId))}(id) on delete restrict`
      )
      ddl.push(
        `create index ${q(`${table.name}_${column.name}_idx`)} on ${name}(${q(column.name)})`
      )
    }
    constraints.push(
      `alter table ${name} add constraint ${q(`${table.name}_parent_${snakeCase(object.parent.typeId)}_fk`)} foreign key(parent_id) references ${q(tableFor(object.parent.typeId))}(id) on delete restrict`,
      `alter table ${name} add constraint ${q(`${table.name}_object_parent_fk`)} foreign key(id,parent_id) references objects(id,parent_id) on delete cascade`
    )
    for (const [rule, keys] of Object.entries(object.uniqueBy))
      ddl.push(
        `create unique index ${q(objectUniqueConstraintName(table.name, rule))} on ${name} (${keys.map((key) => q(columns[key === "parent" ? "parentId" : physicalPropertyKey(key, object.properties[key]!)]!.name)).join(", ")})`
      )
  }
  ddl.push("-- Relationships: association pairs and cardinality constraints")
  for (const link of Object.values(model.links)) {
    const table = defineTable(
      claim(snakeCase(link.id)),
      {
        forwardId: {
          type: "text",
          description: `${link.forward.from.typeId}: ${link.forward.key}.`,
        },
        reverseId: {
          type: "text",
          description: `${link.reverse.from.typeId}: ${link.reverse.key}.`,
        },
      },
      {
        description: `${link.name} (${link.id}).${link.subsetOf ? ` A selection from ${link.subsetOf}; removing membership clears the selection.` : ""}`,
        constraints: [
          "primary key(forward_id,reverse_id)",
          `foreign key(forward_id) references ${q(tableFor(link.forward.from.typeId))}(id) on delete ${link.reverse.cardinality === "one" ? "restrict" : "cascade"}`,
          `foreign key(reverse_id) references ${q(tableFor(link.reverse.from.typeId))}(id) on delete ${link.forward.cardinality === "one" ? "restrict" : "cascade"}`,
        ],
      }
    )
    linkTables[link.id] = table
    ddl.push(...table.ddl)
    for (const [side, definition] of [
      ["forward", link.forward],
      ["reverse", link.reverse],
    ] as const)
      ddl.push(
        `create ${definition.cardinality === "many" ? "" : "unique "}index ${q(`${table.name}_${side}_id_${definition.cardinality === "many" ? "idx" : "unique"}`)} on ${q(table.name)}(${side}_id)`
      )
    if (link.subsetOf)
      constraints.push(
        `alter table ${q(table.name)} add constraint ${q(`${table.name}_membership_fk`)} foreign key(forward_id,reverse_id) references ${q(snakeCase(link.subsetOf))}(forward_id,reverse_id) on delete cascade`
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
      "-- Cross-table constraints (declared after their targets to support cycles)",
      ...constraints,
    ],
  } as unknown as PostgresStorage<M>
}
