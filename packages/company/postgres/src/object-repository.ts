/* oxlint-disable anti-slop/no-unknown-parameters, eslint/no-underscore-dangle -- This adapter unwraps structured Effect and Drizzle provider failures at the persistence boundary. */
import { Buffer } from "node:buffer"

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  RecordId,
  type RecordAlias,
  type RecordAliasUpdate,
  type ModelCatalog,
  type ModelObjectRef,
  linkReferenceTraversals,
  PageToken,
  Timestamp,
  type InferProperty,
  type ObjectRecord,
  type ObjectSort,
  type ObjectType,
  type Page,
  type ObjectRef,
} from "@company/runtime"
import {
  toEffectInputSchema,
  toEffectObjectSchema,
} from "@company/runtime/effect"
import {
  ObjectNotFound,
  ObjectUniqueConflict,
  RecordAliasConflict,
  RecordAliasNotFound,
  ObjectParentNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
  InvalidListRequest,
  type ObjectDeleteTarget,
  type ObjectInsert,
  type ObjectRepositoryUpdate,
  type RepositoryListRequest,
  type RepositoryListVisibility,
  type RepositoryFilter,
  type Repository,
} from "@company/runtime/effect/object-repository"
import {
  and,
  asc,
  desc,
  eq,
  getTableName,
  getTableColumns,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  notInArray,
  or,
  sql,
  type Column,
  type AnyRelations,
  type SQL,
} from "drizzle-orm"
import { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"
import type {
  AnyPgTable,
  PgInsertValue,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core"
import { Cause, Effect, Option, Schema } from "effect"
import { isSqlError, type SqlError } from "effect/unstable/sql/SqlError"

import {
  objectUniqueConstraintName,
  physicalPropertyKey,
  type PostgresStorage,
} from "./schema"

type StoragePropertyValues<TObject extends ObjectType> = Partial<
  Readonly<
    Record<
      | (keyof TObject["properties"] & string)
      | `${keyof TObject["properties"] & string}Id`,
      InferProperty<TObject["properties"][keyof TObject["properties"] & string]>
    >
  >
>

type ObjectInsertPropertyValues<TObject extends ObjectType> = Omit<
  ObjectInsert<TObject>,
  | "aliases"
  | "metadata"
  | "createdBy"
  | "id"
  | "parent"
  | "systemManaged"
  | "updatedBy"
>

type ObjectUpdatePropertyValues<TObject extends ObjectType> = Omit<
  ObjectRepositoryUpdate<TObject>,
  "aliases" | "etag" | "id" | "metadata" | "updatedBy"
>

type CanonicalStoragePropertyValues<TObject extends ObjectType> =
  | ObjectInsertPropertyValues<TObject>
  | ObjectUpdatePropertyValues<TObject>

export type PostgresRepositoryError =
  | EffectDrizzleQueryError
  | InvalidListRequest
  | RecordAliasConflict
  | ObjectNotFound
  | ObjectParentNotFound
  | ObjectParentTypeMismatch
  | ObjectUniqueConflict
  | ObjectWriteConflict
  | Schema.SchemaError
  | SqlError

export type PostgresRecordAliasResolutionError =
  | EffectDrizzleQueryError
  | RecordAliasNotFound

interface CursorPayload {
  readonly fingerprint: string
  readonly values: ReadonlyArray<QueryValue>
  readonly version: 1
}

interface CursorSort {
  readonly direction: "asc" | "desc"
  readonly field: string
  readonly nulls?: "first" | "last"
}

type QueryValue = boolean | null | number | string

interface UniqueConstraint {
  readonly fields: ReadonlyArray<string>
  readonly rule: string
}

function wrappedSqlError(error: unknown): SqlError | undefined {
  if (isSqlError(error)) return error
  if (Cause.isCause(error)) {
    return wrappedSqlError(Option.getOrUndefined(Cause.findErrorOption(error)))
  }
  return error instanceof EffectDrizzleQueryError
    ? wrappedSqlError(error.cause)
    : undefined
}

function translateUniqueConflict<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  object: ObjectType,
  constraints: ReadonlyMap<string, UniqueConstraint>
): Effect.Effect<A, E | ObjectUniqueConflict, R> {
  return Effect.mapError(effect, (error) => {
    const sqlError = wrappedSqlError(error)
    const constraint =
      sqlError?.reason._tag === "UniqueViolation"
        ? constraints.get(sqlError.reason.constraint)
        : undefined
    return constraint === undefined
      ? error
      : new ObjectUniqueConflict({
          fields: constraint.fields,
          objectType: object.id,
          rule: constraint.rule,
        })
  })
}

const queryValueSchema = Schema.Union([
  Schema.Boolean,
  Schema.Null,
  Schema.Number,
  Schema.String,
])

const cursorPayloadSchema = Schema.Struct({
  fingerprint: Schema.String,
  values: Schema.Array(queryValueSchema),
  version: Schema.Literal(1),
})

interface ResolvedSort {
  readonly column: Column
  readonly direction: "asc" | "desc"
  readonly field: string
  readonly nulls: "first" | "last"
}

function orderExpression(sort: ResolvedSort): SQL {
  const ordered =
    sort.direction === "asc" ? asc(sort.column) : desc(sort.column)
  return sort.nulls === "first"
    ? sql`${ordered} nulls first`
    : sql`${ordered} nulls last`
}

function equalCursorValue(sort: ResolvedSort, value: QueryValue): SQL {
  return value === null ? isNull(sort.column) : eq(sort.column, value)
}

function laterCursorValue(
  sort: ResolvedSort,
  value: QueryValue
): SQL | undefined {
  if (value === null) {
    return sort.nulls === "first" ? isNotNull(sort.column) : undefined
  }
  const comparison =
    sort.direction === "asc" ? gt(sort.column, value) : lt(sort.column, value)
  return sort.nulls === "last"
    ? or(comparison, isNull(sort.column))
    : comparison
}

function cursorCondition(
  sort: ReadonlyArray<ResolvedSort>,
  values: ReadonlyArray<QueryValue>,
  index = 0
): SQL | undefined {
  const current = sort[index]
  const value = values[index]
  if (current === undefined || value === undefined) return undefined
  const later = laterCursorValue(current, value)
  const tied = cursorCondition(sort, values, index + 1)
  const tiedAndLater =
    tied === undefined ? undefined : and(equalCursorValue(current, value), tied)
  return or(later, tiedAndLater)
}

function recordValue<TObject extends ObjectType>(
  record: ObjectRecord<TObject>,
  field: string
): QueryValue {
  const value = Object.entries(record).find(([key]) => key === field)?.[1]
  return Schema.decodeUnknownSync(queryValueSchema)(value)
}

function invalidListRequest(object: ObjectType, message: string) {
  return new InvalidListRequest({ message, objectType: object.id })
}

function escapeLike(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
}

function cursorFingerprint<TObject extends ObjectType>(
  request: RepositoryListRequest<TObject>,
  sort: ReadonlyArray<CursorSort>
): string {
  return JSON.stringify({ filter: request.filter ?? null, sort })
}

function encodeCursor(payload: CursorPayload): PageToken {
  return PageToken(Buffer.from(JSON.stringify(payload)).toString("base64url"))
}

function decodeCursor(
  object: ObjectType,
  token: PageToken,
  fingerprint: string,
  valueCount: number
): CursorPayload {
  try {
    const parsed = Schema.decodeUnknownSync(cursorPayloadSchema)(
      JSON.parse(Buffer.from(token, "base64url").toString("utf8"))
    )
    if (
      parsed.fingerprint !== fingerprint ||
      parsed.values.length !== valueCount
    ) {
      throw invalidListRequest(
        object,
        "The page token does not match this list request."
      )
    }
    return { version: 1, fingerprint, values: parsed.values }
  } catch (error) {
    if (error instanceof InvalidListRequest) throw error
    throw invalidListRequest(object, "The page token is invalid.")
  }
}

function notFound(object: ObjectType, id: string) {
  return new ObjectNotFound({ objectType: object.id, recordId: id })
}

function conflict(object: ObjectType, id: string) {
  return new ObjectWriteConflict({ objectType: object.id, recordId: id })
}

function isAliasReplacement(
  update: RecordAliasUpdate
): update is ReadonlyArray<RecordAlias> {
  return Array.isArray(update)
}

function makeObjectRef<const TObjectType extends string>(
  objectType: TObjectType,
  id: string
): ObjectRef<TObjectType> {
  const dynamicObjectType: string = objectType
  const reference = { id: RecordId(dynamicObjectType)(id), objectType }
  // SAFETY: ObjectRef distributes over object-type unions; this helper keeps
  // the validated branded ID paired with its object-type discriminator.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return reference as ObjectRef<TObjectType>
}

/** Resolves globally unique aliases in input order without requiring object types. */
export function resolveRecordAliases<
  const TModel extends ModelCatalog,
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  db: EffectPgDatabase<TRelations>,
  aliases: ReadonlyArray<RecordAlias>
): Effect.Effect<
  ReadonlyArray<ModelObjectRef<TModel>>,
  PostgresRecordAliasResolutionError
> {
  if (aliases.length === 0) return Effect.succeed([])
  const { recordAliases, objects } = storage.core
  return Effect.gen(function* () {
    const rows = yield* db
      .select({
        alias: recordAliases.alias,
        id: objects.id,
        objectType: objects.objectType,
      })
      .from(recordAliases)
      .innerJoin(objects, eq(recordAliases.objectId, objects.id))
      .where(inArray(recordAliases.alias, [...new Set(aliases)]))
    const byAlias = new Map(rows.map((row) => [row.alias, row]))
    const references: Array<ModelObjectRef<TModel>> = []
    for (const alias of aliases) {
      const resolved = byAlias.get(alias)
      if (resolved === undefined) {
        return yield* Effect.fail(new RecordAliasNotFound({ alias }))
      }
      if (resolved.objectType === storage.model.root.id) {
        return yield* Effect.die(
          `Model root '${resolved.id}' cannot own a record alias.`
        )
      }
      if (!Object.hasOwn(storage.model.objects, resolved.objectType)) {
        return yield* Effect.die(
          `Alias '${alias}' resolved to unknown object type '${resolved.objectType}'.`
        )
      }
      references.push(makeObjectRef(resolved.objectType, resolved.id))
    }
    return references
  })
}

/**
 * Builds the standard repository for one semantic object and its Drizzle
 * storage table. Company-specific repositories may add typed queries to the
 * returned capability without bypassing its hydration and write invariants.
 */
export function makeObjectRepository<
  const TModel extends ModelCatalog,
  const TObject extends TModel["objects"][keyof TModel["objects"] & string],
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  object: TObject,
  db: EffectPgDatabase<TRelations>
): Effect.Effect<Repository<TObject, PostgresRepositoryError>> {
  return Effect.gen(function* () {
    const { recordAliases, objects } = storage.core
    const table = Object.entries(storage.objects).find(
      ([objectType]) => objectType === object.id
    )?.[1]
    if (table === undefined) {
      return yield* Effect.die(
        `Object '${object.id}' does not have a PostgreSQL storage table.`
      )
    }
    const tableName = getTableName(table)
    const uniqueConstraints = new Map<string, UniqueConstraint>()
    for (const [rule, fields] of Object.entries(object.uniqueBy)) {
      uniqueConstraints.set(objectUniqueConstraintName(tableName, rule), {
        fields,
        rule,
      })
    }
    for (const link of Object.values(storage.model.links)) {
      const reference = linkReferenceTraversals(link)
      if (
        reference === undefined ||
        reference.source.from.typeId !== object.id ||
        reference.source.cardinality === "many" ||
        reference.target.cardinality === "many"
      ) {
        continue
      }
      const field = reference.source.key
      uniqueConstraints.set(objectUniqueConstraintName(tableName, field), {
        fields: [field],
        rule: link.id,
      })
    }
    const parentInterfaceTable =
      object.parent.kind === "interface"
        ? Object.entries(storage.interfaces).find(
            ([interfaceId]) => interfaceId === object.parent.typeId
          )?.[1]
        : undefined
    if (
      object.parent.kind === "interface" &&
      parentInterfaceTable === undefined
    ) {
      return yield* Effect.die(
        `Parent interface '${object.parent.typeId}' does not have a PostgreSQL storage table.`
      )
    }
    const interfaceTables: ReadonlyArray<AnyPgTable> = Object.values(
      object.interfaces
    ).map((implementation) => {
      const interfaceTable = Object.entries(storage.interfaces).find(
        ([interfaceId]) => interfaceId === implementation.interfaceId
      )?.[1]
      if (interfaceTable === undefined) {
        throw new Error(
          `Interface '${implementation.interfaceId}' does not have a PostgreSQL storage table.`
        )
      }
      return interfaceTable
    })
    const storageColumns = getTableColumns(table)
    const idColumn = storageColumns.id
    if (idColumn === undefined) {
      return yield* Effect.die(
        `Storage table for object '${object.id}' must declare an id column.`
      )
    }
    if (storageColumns.parentId === undefined) {
      return yield* Effect.die(
        `Storage table for object '${object.id}' must declare a parentId column.`
      )
    }
    const propertyColumns = Object.fromEntries(
      Object.entries(object.properties).map(([propertyId, property]) => {
        const storageKey = physicalPropertyKey(propertyId, property)
        const column = storageColumns[storageKey]
        if (column === undefined) {
          throw new Error(
            `Storage table for object '${object.id}' must declare property column '${storageKey}'.`
          )
        }
        return [propertyId, column]
      })
    )
    const columns = { id: idColumn, ...propertyColumns }
    const toStorageProperties = (
      properties: CanonicalStoragePropertyValues<TObject>
    ): StoragePropertyValues<TObject> =>
      // SAFETY: every input key is drawn from this object's declared
      // properties; only record references receive the physical `Id` suffix.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      Object.fromEntries(
        Object.entries(properties).map(([propertyId, value]) => [
          physicalPropertyKey(propertyId, object.properties[propertyId]!),
          value,
        ])
      ) as StoragePropertyValues<TObject>
    const RecordSchema = toEffectObjectSchema(object)
    const RecordsSchema = Schema.Array(RecordSchema)
    const selection = {
      ...columns,
      aliases: sql<ReadonlyArray<RecordAlias>>`array(
        select ${recordAliases.alias}
        from ${recordAliases}
        where ${recordAliases.objectId} = ${objects.id}
        order by ${recordAliases.alias}
      )`,
      metadata: objects.metadata,
      createdAt: objects.createdAt,
      createdBy: objects.createdById,
      etag: objects.etag,
      parent: objects.parentId,
      systemManaged: objects.systemManaged,
      updatedAt: objects.updatedAt,
      updatedBy: objects.updatedById,
    }

    const queryColumns = {
      ...columns,
      createdAt: objects.createdAt,
      createdBy: objects.createdById,
      id: idColumn,
      parent: objects.parentId,
      systemManaged: objects.systemManaged,
      updatedAt: objects.updatedAt,
      updatedBy: objects.updatedById,
    }

    const columnFor = (field: string): Column => {
      const column = Object.entries(queryColumns).find(
        ([columnName]) => columnName === field
      )?.[1]
      if (column === undefined) {
        throw invalidListRequest(
          object,
          `Field '${field}' cannot be filtered or sorted.`
        )
      }
      return column
    }

    const allowedOperators = (field: string): ReadonlySet<string> => {
      if (field === "id" || field === "parent") {
        return new Set(["eq", "in"])
      }
      if (field === "createdBy" || field === "updatedBy") {
        return new Set(["eq", "in"])
      }
      if (field === "systemManaged") return new Set(["eq", "in"])
      if (field === "createdAt" || field === "updatedAt") {
        return new Set(["eq", "gt", "gte", "in", "lt", "lte"])
      }

      const property = object.properties[field]
      if (property === undefined) return new Set()
      const nullable = property.nullable ? ["isNull"] : []
      switch (property.kind) {
        case "boolean":
        case "enum":
        case "recordId":
          return new Set(["eq", "in", ...nullable])
        case "decimal":
        case "number":
          return new Set(["eq", "gt", "gte", "in", "lt", "lte", ...nullable])
        case "string":
          return property.format === "date" || property.format === "timestamp"
            ? new Set(["eq", "gt", "gte", "in", "lt", "lte", ...nullable])
            : new Set([
                "contains",
                "endsWith",
                "eq",
                "in",
                "startsWith",
                ...nullable,
              ])
        default:
          return new Set()
      }
    }

    const decodeFilterValue = (
      field: string,
      value: QueryValue
    ): Exclude<QueryValue, null> => {
      if (value === null || value === undefined) {
        throw invalidListRequest(
          object,
          `Filter property '${field}' requires a non-null value.`
        )
      }
      const property = object.properties[field]
      if (property !== undefined) {
        const decoded = Schema.decodeUnknownSync(toEffectInputSchema(property))(
          value
        )
        const queryValue = Schema.decodeUnknownSync(queryValueSchema)(decoded)
        if (queryValue === null) {
          throw invalidListRequest(
            object,
            `Filter property '${field}' requires a non-null value.`
          )
        }
        return queryValue
      }
      if (field === "systemManaged") {
        return Schema.decodeUnknownSync(Schema.Boolean)(value)
      }
      const textValue = Schema.decodeUnknownSync(Schema.String)(value)
      if (field === "id" || field === "parent") {
        if (textValue.length === 0) {
          throw invalidListRequest(
            object,
            `Filter property '${field}' requires a non-empty record ID.`
          )
        }
        return textValue
      }
      if (field === "createdBy" || field === "updatedBy") {
        return RecordId("actor")(textValue)
      }
      if (field === "createdAt" || field === "updatedAt") {
        return Timestamp(textValue)
      }
      throw invalidListRequest(object, `Unknown filter property '${field}'.`)
    }

    const decodeStringFilterValue = (field: string, value: string): string =>
      Schema.decodeUnknownSync(Schema.String)(decodeFilterValue(field, value))

    const compileFilter = (filter: RepositoryFilter<TObject>): SQL => {
      if ("and" in filter) {
        if (filter.and.length === 0) {
          throw invalidListRequest(object, "An 'and' filter cannot be empty.")
        }
        return and(...filter.and.map(compileFilter))!
      }
      if ("or" in filter) {
        if (filter.or.length === 0) {
          throw invalidListRequest(object, "An 'or' filter cannot be empty.")
        }
        return or(...filter.or.map(compileFilter))!
      }
      if ("not" in filter) return not(compileFilter(filter.not))!

      const column = columnFor(filter.field)
      if (!allowedOperators(filter.field).has(filter.operator)) {
        throw invalidListRequest(
          object,
          `Operator '${filter.operator}' is not supported for property '${filter.field}'.`
        )
      }

      switch (filter.operator) {
        case "contains": {
          const value = decodeStringFilterValue(filter.field, filter.value)
          return ilike(column, `%${escapeLike(value)}%`)
        }
        case "endsWith": {
          const value = decodeStringFilterValue(filter.field, filter.value)
          return ilike(column, `%${escapeLike(value)}`)
        }
        case "eq":
          return eq(
            column,
            decodeFilterValue(
              filter.field,
              Schema.decodeUnknownSync(queryValueSchema)(filter.value)
            )
          )
        case "gt":
          return gt(
            column,
            decodeFilterValue(
              filter.field,
              Schema.decodeUnknownSync(queryValueSchema)(filter.value)
            )
          )
        case "gte":
          return gte(
            column,
            decodeFilterValue(
              filter.field,
              Schema.decodeUnknownSync(queryValueSchema)(filter.value)
            )
          )
        case "in": {
          if (!Array.isArray(filter.value)) {
            throw invalidListRequest(
              object,
              "Operator 'in' requires an array value."
            )
          }
          const values = filter.value.map((value) =>
            decodeFilterValue(
              filter.field,
              Schema.decodeUnknownSync(queryValueSchema)(value)
            )
          )
          return values.length === 0 ? sql`false` : inArray(column, values)
        }
        case "isNull":
          return isNull(column)
        case "lt":
          return lt(
            column,
            decodeFilterValue(
              filter.field,
              Schema.decodeUnknownSync(queryValueSchema)(filter.value)
            )
          )
        case "lte":
          return lte(
            column,
            decodeFilterValue(
              filter.field,
              Schema.decodeUnknownSync(queryValueSchema)(filter.value)
            )
          )
        case "startsWith": {
          const value = decodeStringFilterValue(filter.field, filter.value)
          return ilike(column, `${escapeLike(value)}%`)
        }
      }
      throw invalidListRequest(object, "The filter operator is invalid.")
    }

    const resolveSort = (
      request: RepositoryListRequest<TObject>
    ): ReadonlyArray<ResolvedSort> => {
      const requested: Array<ObjectSort<TObject>> = [...(request.sort ?? [])]
      const duplicate = requested.find(
        (candidate, index) =>
          requested.findIndex(({ field }) => field === candidate.field) !==
          index
      )
      if (duplicate !== undefined) {
        throw invalidListRequest(
          object,
          `Sort property '${duplicate.field}' is declared more than once.`
        )
      }
      if (!requested.some(({ field }) => field === "id")) {
        requested.push({ direction: "asc", field: "id" })
      }
      return requested.map((sort) => {
        const property = object.properties[sort.field]
        if (
          property !== undefined &&
          !new Set([
            "boolean",
            "decimal",
            "enum",
            "number",
            "recordId",
            "string",
          ]).has(property.kind)
        ) {
          throw invalidListRequest(
            object,
            `Property '${sort.field}' cannot be sorted.`
          )
        }
        return {
          ...sort,
          column: columnFor(sort.field),
          nulls: sort.nulls ?? "last",
        }
      })
    }

    const select = (
      where?: SQL,
      orderBy: ReadonlyArray<SQL> = [asc(idColumn)]
    ) => {
      // SAFETY: the runtime check above proves this generic table has a
      // selectable ID column; Drizzle RC cannot express that generic fact.
      const query = db
        .select(selection)
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        .from(table as never)
        .innerJoin(objects, eq(idColumn, objects.id))
      const filtered = where === undefined ? query : query.where(where)
      return filtered.orderBy(...orderBy)
    }

    const decodeRecord = Schema.decodeUnknownEffect(RecordSchema)
    const decodeRecords = Schema.decodeUnknownEffect(RecordsSchema)

    const get = Effect.fn(`${object.id}.repository.get`)(function* (
      id: RecordId<TObject["id"]>
    ) {
      const rows = yield* select(eq(idColumn, id)).limit(1)
      const row = rows[0]
      if (row === undefined) return yield* Effect.fail(notFound(object, id))
      return yield* decodeRecord(row)
    })

    const batchGet = Effect.fn(`${object.id}.repository.batchGet`)(function* (
      ids: ReadonlyArray<RecordId<TObject["id"]>>
    ) {
      if (ids.length === 0) return []

      const records = yield* select(inArray(idColumn, ids)).pipe(
        Effect.flatMap(decodeRecords)
      )
      const byId = new Map(records.map((record) => [record.id, record]))
      const missing = ids.find((id) => !byId.has(id))
      if (missing !== undefined)
        return yield* Effect.fail(notFound(object, missing))

      return ids.map((id) => byId.get(id)!)
    })

    const list = Effect.fn(`${object.id}.repository.list`)(function* (
      request: RepositoryListRequest<TObject> = {},
      visibility?: RepositoryListVisibility
    ): Effect.fn.Return<Page<ObjectRecord<TObject>>, PostgresRepositoryError> {
      const size = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, request.pageSize ?? DEFAULT_PAGE_SIZE)
      )
      const resolvedSort = yield* Effect.try({
        try: () => resolveSort(request),
        catch: (error) =>
          error instanceof InvalidListRequest
            ? error
            : invalidListRequest(object, "The sort request is invalid."),
      })
      const publicSort = resolvedSort.map(
        ({ column: _column, ...sort }) => sort
      )
      const fingerprint = cursorFingerprint(request, publicSort)
      const cursor =
        request.pageToken === undefined
          ? undefined
          : yield* Effect.try({
              try: () =>
                decodeCursor(
                  object,
                  request.pageToken!,
                  fingerprint,
                  resolvedSort.length
                ),
              catch: (error) =>
                error instanceof InvalidListRequest
                  ? error
                  : invalidListRequest(object, "The page token is invalid."),
            })
      const filter = yield* Effect.try({
        try: () =>
          request.filter === undefined
            ? undefined
            : compileFilter(request.filter),
        catch: (error) =>
          error instanceof InvalidListRequest
            ? error
            : invalidListRequest(object, "The filter request is invalid."),
      })
      const after =
        cursor === undefined
          ? undefined
          : cursorCondition(resolvedSort, cursor.values)
      const visible =
        visibility === undefined
          ? undefined
          : visibility.visibleWithin.length === 0
            ? sql`false`
            : or(
                inArray(idColumn, visibility.visibleWithin),
                sql`${objects.ancestorIds} && array[${sql.join(
                  visibility.visibleWithin.map((scopeId) => sql`${scopeId}`),
                  sql`, `
                )}]::text[]`
              )
      const records = yield* select(
        and(filter, after, visible),
        resolvedSort.map(orderExpression)
      )
        .limit(size + 1)
        .pipe(Effect.flatMap(decodeRecords))
      const hasNextPage = records.length > size
      const items = hasNextPage ? records.slice(0, size) : records
      const last = items.at(-1)
      return {
        items,
        nextPageToken:
          hasNextPage && last !== undefined
            ? encodeCursor({
                fingerprint,
                values: resolvedSort.map(({ field }) =>
                  recordValue(last, field)
                ),
                version: 1,
              })
            : "",
      }
    })

    const insert = Effect.fn(`${object.id}.repository.insert`)(function* (
      record: ObjectInsert<TObject>
    ) {
      const {
        aliases,
        metadata,
        createdBy,
        id,
        parent: parentId,
        systemManaged,
        updatedBy,
        ...properties
      } = record

      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const parentRows = yield* tx
            .select({
              ancestorIds: objects.ancestorIds,
              objectType: objects.objectType,
            })
            .from(objects)
            .where(eq(objects.id, parentId))
            .limit(1)
          const parent = parentRows[0]
          if (parent === undefined) {
            return yield* Effect.fail(
              new ObjectParentNotFound({
                objectType: object.id,
                parentId,
              })
            )
          }
          const parentMatches =
            parentInterfaceTable !== undefined
              ? (yield* tx
                  .select({ id: parentInterfaceTable.id })
                  .from(parentInterfaceTable)
                  .where(eq(parentInterfaceTable.id, parentId))
                  .limit(1)).length === 1
              : parent.objectType === object.parent.typeId
          if (!parentMatches) {
            return yield* Effect.fail(
              new ObjectParentTypeMismatch({
                actualParentObjectType: parent.objectType,
                expectedParentTypeId: object.parent.typeId,
                objectType: object.id,
                parentId,
              })
            )
          }

          yield* tx.insert(objects).values({
            ancestorIds: [parentId, ...parent.ancestorIds],
            metadata,
            createdById: createdBy,
            id,
            objectType: object.id,
            parentId,
            systemManaged,
            updatedById: updatedBy,
          })
          if (aliases.length > 0) {
            yield* tx
              .insert(recordAliases)
              .values(aliases.map((alias) => ({ alias, objectId: id })))
              .onConflictDoNothing()
            const owners = yield* tx
              .select({
                alias: recordAliases.alias,
                objectId: recordAliases.objectId,
              })
              .from(recordAliases)
              .where(inArray(recordAliases.alias, [...aliases]))
            const conflictOwner = owners.find((owner) => owner.objectId !== id)
            if (conflictOwner !== undefined) {
              return yield* Effect.fail(
                new RecordAliasConflict({
                  alias: conflictOwner.alias,
                  conflictingRecordId: conflictOwner.objectId,
                  recordId: id,
                })
              )
            }
          }
          const objectValues = {
            id,
            ...toStorageProperties(properties),
            parentId,
          }
          // SAFETY: the portable object schema validates the property values,
          // while the model-derived storage projection supplies this table.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const objectRow = objectValues as PgInsertValue<typeof table>
          yield* tx.insert(table).values(objectRow)
          for (const interfaceTable of interfaceTables) {
            // SAFETY: interface storage tables are ID-only projections whose
            // rows are transactionally derived from declared implementations.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            const interfaceRow = { id } as PgInsertValue<typeof interfaceTable>
            yield* tx.insert(interfaceTable).values(interfaceRow)
          }
          return undefined
        }).pipe((effect) =>
          translateUniqueConflict(effect, object, uniqueConstraints)
        )
      )

      return yield* get(id)
    })

    const upsert = Effect.fn(`${object.id}.repository.upsert`)(function* (
      record: ObjectInsert<TObject>
    ) {
      const {
        aliases,
        metadata,
        createdBy,
        id,
        parent: parentId,
        systemManaged,
        updatedBy,
        ...properties
      } = record

      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const parentRows = yield* tx
            .select({
              ancestorIds: objects.ancestorIds,
              objectType: objects.objectType,
            })
            .from(objects)
            .where(eq(objects.id, parentId))
            .limit(1)
          const parent = parentRows[0]
          if (parent === undefined) {
            return yield* Effect.fail(
              new ObjectParentNotFound({ objectType: object.id, parentId })
            )
          }
          const parentMatches =
            parentInterfaceTable !== undefined
              ? (yield* tx
                  .select({ id: parentInterfaceTable.id })
                  .from(parentInterfaceTable)
                  .where(eq(parentInterfaceTable.id, parentId))
                  .limit(1)).length === 1
              : parent.objectType === object.parent.typeId
          if (!parentMatches) {
            return yield* Effect.fail(
              new ObjectParentTypeMismatch({
                actualParentObjectType: parent.objectType,
                expectedParentTypeId: object.parent.typeId,
                objectType: object.id,
                parentId,
              })
            )
          }

          const existingRows = yield* tx
            .select({
              objectType: objects.objectType,
              parentId: objects.parentId,
            })
            .from(objects)
            .where(eq(objects.id, id))
            .limit(1)
          const existing = existingRows[0]
          if (
            existing !== undefined &&
            (existing.objectType !== object.id ||
              existing.parentId !== parentId)
          ) {
            return yield* Effect.fail(conflict(object, id))
          }

          yield* tx
            .insert(objects)
            .values({
              ancestorIds: [parentId, ...parent.ancestorIds],
              metadata,
              createdById: createdBy,
              id,
              objectType: object.id,
              parentId,
              systemManaged,
              updatedById: updatedBy,
            })
            .onConflictDoUpdate({
              target: objects.id,
              set: {
                metadata,
                etag: sql`gen_random_uuid()::text`,
                systemManaged,
                updatedAt: sql`now()`,
                updatedById: updatedBy,
              },
            })

          if (aliases.length > 0) {
            yield* tx
              .insert(recordAliases)
              .values(aliases.map((alias) => ({ alias, objectId: id })))
              .onConflictDoNothing()
            const owners = yield* tx
              .select({
                alias: recordAliases.alias,
                objectId: recordAliases.objectId,
              })
              .from(recordAliases)
              .where(inArray(recordAliases.alias, [...aliases]))
            const conflictOwner = owners.find((owner) => owner.objectId !== id)
            if (conflictOwner !== undefined) {
              return yield* Effect.fail(
                new RecordAliasConflict({
                  alias: conflictOwner.alias,
                  conflictingRecordId: conflictOwner.objectId,
                  recordId: id,
                })
              )
            }
          }
          yield* tx
            .delete(recordAliases)
            .where(
              aliases.length === 0
                ? eq(recordAliases.objectId, id)
                : and(
                    eq(recordAliases.objectId, id),
                    notInArray(recordAliases.alias, [...aliases])
                  )
            )

          const storageProperties = toStorageProperties(properties)
          const objectValues = { id, ...storageProperties, parentId }
          // SAFETY: the portable object schema validates the complete record,
          // while the model-derived projection supplies this exact table.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const objectRow = objectValues as PgInsertValue<typeof table>
          const inserted = tx.insert(table).values(objectRow)
          if (Object.keys(storageProperties).length === 0) {
            yield* inserted.onConflictDoNothing()
          } else {
            // SAFETY: the complete seed record carries this object's canonical
            // property values and never changes its semantic parent.
            // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
            const changes = storageProperties as unknown as PgUpdateSetSource<
              typeof table
            >
            yield* inserted.onConflictDoUpdate({
              target: idColumn,
              set: changes,
            })
          }
          for (const interfaceTable of interfaceTables) {
            // SAFETY: interface tables are same-ID projections derived from
            // the model declaration.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
            const interfaceRow = { id } as PgInsertValue<typeof interfaceTable>
            yield* tx
              .insert(interfaceTable)
              .values(interfaceRow)
              .onConflictDoNothing()
          }
          return undefined
        }).pipe((effect) =>
          translateUniqueConflict(effect, object, uniqueConstraints)
        )
      )

      return yield* get(id)
    })

    const update = Effect.fn(`${object.id}.repository.update`)(function* ({
      aliases,
      etag,
      id,
      metadata,
      updatedBy,
      ...properties
    }: ObjectRepositoryUpdate<TObject>) {
      const storageProperties = toStorageProperties(properties)
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const updated = yield* tx
            .update(objects)
            .set(
              metadata === undefined
                ? {
                    etag: sql`gen_random_uuid()::text`,
                    updatedAt: sql`now()`,
                    updatedById: updatedBy,
                  }
                : {
                    etag: sql`gen_random_uuid()::text`,
                    metadata,
                    updatedAt: sql`now()`,
                    updatedById: updatedBy,
                  }
            )
            .where(
              and(
                eq(objects.id, id),
                eq(objects.objectType, object.id),
                eq(objects.etag, etag)
              )
            )
            .returning({ id: objects.id })
          if (updated.length === 0)
            return yield* Effect.fail(conflict(object, id))

          const aliasesToAdd =
            aliases === undefined
              ? []
              : isAliasReplacement(aliases)
                ? aliases
                : (aliases.add ?? [])
          if (aliasesToAdd.length > 0) {
            yield* tx
              .insert(recordAliases)
              .values(aliasesToAdd.map((alias) => ({ alias, objectId: id })))
              .onConflictDoNothing()
            const owners = yield* tx
              .select({
                alias: recordAliases.alias,
                objectId: recordAliases.objectId,
              })
              .from(recordAliases)
              .where(inArray(recordAliases.alias, [...aliasesToAdd]))
            const conflictOwner = owners.find((owner) => owner.objectId !== id)
            if (conflictOwner !== undefined) {
              return yield* Effect.fail(
                new RecordAliasConflict({
                  alias: conflictOwner.alias,
                  conflictingRecordId: conflictOwner.objectId,
                  recordId: id,
                })
              )
            }
          }

          if (aliases !== undefined) {
            if (isAliasReplacement(aliases)) {
              const replacementCondition =
                aliases.length === 0
                  ? eq(recordAliases.objectId, id)
                  : and(
                      eq(recordAliases.objectId, id),
                      notInArray(recordAliases.alias, [...aliases])
                    )
              yield* tx.delete(recordAliases).where(replacementCondition)
            } else {
              const aliasesToRemove = aliases.remove ?? []
              if (aliasesToRemove.length > 0) {
                yield* tx
                  .delete(recordAliases)
                  .where(
                    and(
                      eq(recordAliases.objectId, id),
                      inArray(recordAliases.alias, [...aliasesToRemove])
                    )
                  )
              }
            }
          }

          if (Object.keys(storageProperties).length > 0) {
            const storageChanges =
              // SAFETY: the portable object update schema validates the values,
              // while this factory is explicitly paired with the same table.
              // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
              storageProperties as unknown as PgUpdateSetSource<typeof table>
            yield* tx.update(table).set(storageChanges).where(eq(idColumn, id))
          }
          return undefined
        }).pipe((effect) =>
          translateUniqueConflict(effect, object, uniqueConstraints)
        )
      )

      return yield* get(id)
    })

    const deleteObject = Effect.fn(`${object.id}.repository.delete`)(
      function* ({ etag, id }: ObjectDeleteTarget<TObject>) {
        const deleted = yield* db
          .delete(objects)
          .where(
            and(
              eq(objects.id, id),
              eq(objects.objectType, object.id),
              eq(objects.etag, etag)
            )
          )
          .returning({ id: objects.id })
        if (deleted.length === 0)
          return yield* Effect.fail(conflict(object, id))
        return undefined
      }
    )

    const batchDelete = Effect.fn(`${object.id}.repository.batchDelete`)(
      function* (targets: ReadonlyArray<ObjectDeleteTarget<TObject>>) {
        if (targets.length === 0) return undefined

        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const targetCondition = or(
              ...targets.map(({ etag, id }) =>
                and(eq(objects.id, id), eq(objects.etag, etag))
              )
            )
            const deleted = yield* tx
              .delete(objects)
              .where(and(eq(objects.objectType, object.id), targetCondition))
              .returning({ id: objects.id })
            const deletedIds = new Set(deleted.map(({ id }) => id))
            const conflictTarget = targets.find(({ id }) => !deletedIds.has(id))
            if (conflictTarget !== undefined) {
              return yield* Effect.fail(conflict(object, conflictTarget.id))
            }
            return undefined
          })
        )
        return undefined
      }
    )

    return {
      batchDelete,
      batchGet,
      delete: deleteObject,
      get,
      insert,
      list,
      update,
      upsert,
    }
  })
}
