import { Buffer } from "node:buffer"

import {
  ActorId,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  RecordId,
  type RecordAlias,
  type RecordAliasUpdate,
  type Model,
  type ModelObjectRef,
  PageToken,
  Timestamp,
  type Etag,
  type ObjectRecord,
  type ObjectSort,
  type ObjectType,
  type Page,
  type ObjectRef,
} from "@continual/runtime"
import { toEffectObjectSchema, toEffectSchema } from "@continual/runtime/effect"
import {
  ObjectNotFound,
  RecordAliasConflict,
  RecordAliasNotFound,
  ObjectParentNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
  InvalidListRequest,
  type ObjectDeleteTarget,
  type ObjectInsert,
  type ObjectUpdateMetadata,
  type ObjectRepositoryUpdate,
  type RepositoryListRequest,
  type RepositoryFilter,
  type Repository,
} from "@continual/runtime/effect/object-repository"
import {
  and,
  asc,
  desc,
  eq,
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
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import type { EffectPgDatabase } from "drizzle-orm/effect-postgres"
import type {
  AnyPgTable,
  PgInsertValue,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core"
import { Effect, Schema } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import type { PostgresStorage } from "./schema"

export type PostgresRepositoryError =
  | EffectDrizzleQueryError
  | InvalidListRequest
  | RecordAliasConflict
  | ObjectNotFound
  | ObjectParentNotFound
  | ObjectParentTypeMismatch
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

/** Resolves a globally unique alias without requiring its object type. */
export function resolveRecordAlias<
  const TModel extends Model,
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  db: EffectPgDatabase<TRelations>,
  alias: RecordAlias
): Effect.Effect<ModelObjectRef<TModel>, PostgresRecordAliasResolutionError> {
  const { recordAliases, objects } = storage.core
  return Effect.gen(function* () {
    const rows = yield* db
      .select({ id: objects.id, objectType: objects.objectType })
      .from(recordAliases)
      .innerJoin(objects, eq(recordAliases.objectId, objects.id))
      .where(eq(recordAliases.alias, alias))
      .limit(1)
    const resolved = rows[0]
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
    const reference = makeObjectRef(resolved.objectType, resolved.id)
    return reference
  })
}

/**
 * Builds the standard repository for one semantic object and its Drizzle
 * storage table. Company-specific repositories may add typed queries to the
 * returned capability without bypassing its hydration and write invariants.
 */
export function makeObjectRepository<
  const TModel extends Model,
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
    const parentColumn = `${object.parent.objectType}Id`
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
    if (storageColumns[parentColumn] === undefined) {
      return yield* Effect.die(
        `Storage table for object '${object.id}' must declare semantic parent column '${parentColumn}'.`
      )
    }
    const columns = Object.fromEntries(
      Object.entries(storageColumns).filter(
        ([columnId]) => columnId !== parentColumn
      )
    )
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
      annotations: objects.annotations,
      createdAt: objects.createdAt,
      createdById: objects.createdById,
      etag: objects.etag,
      parentId: objects.parentId,
      updatedAt: objects.updatedAt,
      updatedById: objects.updatedById,
    }

    const queryColumns = {
      ...columns,
      createdAt: objects.createdAt,
      createdById: objects.createdById,
      id: idColumn,
      parentId: objects.parentId,
      updatedAt: objects.updatedAt,
      updatedById: objects.updatedById,
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
      if (field === "id" || field === "parentId") {
        return new Set(["eq", "in"])
      }
      if (field === "createdById" || field === "updatedById") {
        return new Set(["eq", "in"])
      }
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
        const decoded = Schema.decodeUnknownSync(toEffectSchema(property))(
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
      const textValue = Schema.decodeUnknownSync(Schema.String)(value)
      if (field === "id" || field === "parentId") {
        if (textValue.length === 0) {
          throw invalidListRequest(
            object,
            `Filter property '${field}' requires a non-empty record ID.`
          )
        }
        return textValue
      }
      if (field === "createdById" || field === "updatedById") {
        return ActorId(textValue)
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
      request: RepositoryListRequest<TObject> = {}
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
      const records = yield* select(
        and(filter, after),
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
        annotations,
        createdAt,
        createdById,
        etag,
        id,
        parentId,
        updatedAt,
        updatedById,
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
          if (parent.objectType !== object.parent.objectType) {
            return yield* Effect.fail(
              new ObjectParentTypeMismatch({
                actualParentObjectType: parent.objectType,
                expectedParentObjectType: object.parent.objectType,
                objectType: object.id,
                parentId,
              })
            )
          }

          yield* tx.insert(objects).values({
            ancestorIds: [parentId, ...parent.ancestorIds],
            annotations,
            createdAt,
            createdById,
            etag,
            id,
            objectType: object.id,
            parentId,
            updatedAt,
            updatedById,
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
          const objectValues = { id, ...properties }
          Object.assign(objectValues, { [parentColumn]: parentId })
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
        })
      )

      return yield* get(id)
    })

    const update = Effect.fn(`${object.id}.repository.update`)(function* (
      id: RecordId<TObject["id"]>,
      input: ObjectRepositoryUpdate<TObject>,
      expectedEtag: Etag,
      metadata: ObjectUpdateMetadata
    ) {
      const { aliases, annotations, ...properties } = input
      yield* db.transaction((tx) =>
        Effect.gen(function* () {
          const updated = yield* tx
            .update(objects)
            .set(
              annotations === undefined
                ? metadata
                : { annotations, ...metadata }
            )
            .where(
              and(
                eq(objects.id, id),
                eq(objects.objectType, object.id),
                eq(objects.etag, expectedEtag)
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

          if (Object.keys(properties).length > 0) {
            // SAFETY: the portable object update schema validates the values,
            // while this factory is explicitly paired with the same table.
            // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
            const changes = properties as unknown as PgUpdateSetSource<
              typeof table
            >
            yield* tx.update(table).set(changes).where(eq(idColumn, id))
          }
          return undefined
        })
      )

      return yield* get(id)
    })

    const deleteObject = Effect.fn(`${object.id}.repository.delete`)(function* (
      id: RecordId<TObject["id"]>,
      expectedEtag: Etag
    ) {
      const deleted = yield* db
        .delete(objects)
        .where(
          and(
            eq(objects.id, id),
            eq(objects.objectType, object.id),
            eq(objects.etag, expectedEtag)
          )
        )
        .returning({ id: objects.id })
      if (deleted.length === 0) return yield* Effect.fail(conflict(object, id))
      return undefined
    })

    const batchDelete = Effect.fn(`${object.id}.repository.batchDelete`)(
      function* (targets: ReadonlyArray<ObjectDeleteTarget<TObject>>) {
        if (targets.length === 0) return undefined

        yield* db.transaction((tx) =>
          Effect.gen(function* () {
            const targetCondition = or(
              ...targets.map(({ expectedEtag, id }) =>
                and(eq(objects.id, id), eq(objects.etag, expectedEtag))
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
    }
  })
}
