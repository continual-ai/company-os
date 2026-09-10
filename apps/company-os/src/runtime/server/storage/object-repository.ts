import { Cause, Data, Effect, Option, Schema } from "effect"
import { isSqlError, type SqlError } from "effect/unstable/sql/SqlError"
import type { Fragment } from "effect/unstable/sql/Statement"

import { toEffectObjectSchema } from "#/runtime/contract/schema.ts"
import type {
  ObjectCreateValues,
  ObjectParentRecordId,
  ObjectUpdateValues,
} from "#/runtime/model/definition/object.ts"
import type {
  CanonicalListRequest,
  CanonicalObjectFilter,
} from "#/runtime/model/definition/request.ts"
import {
  normalizePageSize,
  type RecordId,
  type RecordAlias,
  type RecordAliasUpdate,
  type ModelCatalog,
  type PageTokenCodec,
  type InferProperty,
  type ObjectRecord,
  type ObjectType,
  type Page,
  type BaseRecord,
  type Etag,
} from "#/runtime/model/index.ts"
import { type PostgresDatabase } from "#/runtime/server/storage/database.ts"
import {
  cursorCondition,
  cursorFingerprint,
  decodeCursor,
  encodeCursor,
  invalidListRequest,
  makeObjectQueryCompiler,
  orderExpression,
  recordValue,
} from "#/runtime/server/storage/object-query.ts"
import {
  objectUniqueConstraintName,
  physicalPropertyKey,
  type PostgresStorage,
} from "#/runtime/server/storage/schema.ts"
import {
  insertValues,
  assignments,
} from "#/runtime/server/storage/statement.ts"
import {
  sqlValue,
  projection,
  type SelectionRow,
  inValues,
  conflictColumns,
} from "#/runtime/server/storage/statement.ts"
import {
  tableName,
  tableColumns,
  type Table,
  type Column,
} from "#/runtime/server/storage/table.ts"

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

export class ObjectNotFound extends Data.TaggedError("ObjectNotFound")<{
  readonly objectType: string
  readonly recordId: string
}> {}

export class ObjectWriteConflict extends Data.TaggedError(
  "ObjectWriteConflict"
)<{
  readonly objectType: string
  readonly recordId: string
}> {}

class ObjectDeleteRestricted extends Data.TaggedError(
  "ObjectDeleteRestricted"
)<{
  readonly objectType: string
  readonly recordIds: ReadonlyArray<string>
}> {}

class ObjectUniqueConflict extends Data.TaggedError("ObjectUniqueConflict")<{
  readonly fields: ReadonlyArray<string>
  readonly objectType: string
  readonly rule: string
}> {}

class ObjectParentNotFound extends Data.TaggedError("ObjectParentNotFound")<{
  readonly objectType: string
  readonly parentId: string
}> {}

export class ObjectParentTypeMismatch extends Data.TaggedError(
  "ObjectParentTypeMismatch"
)<{
  readonly actualParentObjectType: string
  readonly expectedParentTypeId: string
  readonly objectType: string
  readonly parentId: string
}> {}

export class InvalidListRequest extends Data.TaggedError("InvalidListRequest")<{
  readonly message: string
  readonly objectType: string
}> {}

export class RecordAliasConflict extends Data.TaggedError(
  "RecordAliasConflict"
)<{
  readonly alias: string
  readonly conflictingRecordId: string
  readonly recordId: string
}> {}

export class RecordAliasNotFound extends Data.TaggedError(
  "RecordAliasNotFound"
)<{
  readonly alias: string
}> {}

/** Canonical insert values; persistence supplies the tag and timestamps. */
export type ObjectInsert<TObject extends ObjectType> = Omit<
  BaseRecord<TObject["id"], ObjectParentRecordId<TObject>>,
  "createdAt" | "etag" | "updatedAt"
> &
  Omit<ObjectCreateValues<TObject>, "parent">

/** Canonical update command accepted by persistence. */
export type ObjectRepositoryUpdate<TObject extends ObjectType> =
  ObjectUpdateValues<TObject> & {
    /** Record version that must still exist when the write commits. */
    readonly etag: Etag
    readonly id: RecordId<TObject["id"]>
    readonly updatedBy: ObjectRecord<TObject>["updatedBy"]
  }

/** Canonical query values accepted by a repository list. */
export type RepositoryListRequest<TObject extends ObjectType> =
  CanonicalListRequest<TObject> & {
    /** Internal edge constraint, established by the governed Link service. */
    readonly relatedTo?: {
      readonly linkId: string
      readonly direction: "forward" | "reverse"
      readonly sourceId: string
    }
  }

/** Canonical query filter accepted by a repository list. */
export type RepositoryFilter<TObject extends ObjectType> =
  CanonicalObjectFilter<TObject>

/** Record version that must still exist when an atomic batch delete commits. */
export interface ObjectDeleteTarget<TObject extends ObjectType> {
  readonly etag: Etag
  readonly id: RecordId<TObject["id"]>
}

export type PostgresRepositoryError =
  | InvalidListRequest
  | RecordAliasConflict
  | ObjectNotFound
  | ObjectDeleteRestricted
  | ObjectParentNotFound
  | ObjectParentTypeMismatch
  | ObjectUniqueConflict
  | ObjectWriteConflict
  | Schema.SchemaError
  | SqlError

interface UniqueConstraint {
  readonly fields: ReadonlyArray<string>
  readonly rule: string
}

function wrappedSqlError(error: unknown): SqlError | undefined {
  if (isSqlError(error)) return error
  if (Cause.isCause(error)) {
    return wrappedSqlError(Option.getOrUndefined(Cause.findErrorOption(error)))
  }
  return undefined
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

function translateDeleteRestriction<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  object: ObjectType,
  recordIds: ReadonlyArray<string>
): Effect.Effect<A, E | ObjectDeleteRestricted, R> {
  return Effect.mapError(effect, (error) =>
    wrappedSqlError(error)?.reason._tag === "ConstraintError"
      ? new ObjectDeleteRestricted({ objectType: object.id, recordIds })
      : error
  )
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

function makeRepository<
  const TModel extends ModelCatalog,
  const TObject extends ObjectType,
>(storage: PostgresStorage<TModel>, object: TObject, db: PostgresDatabase) {
  const sql = db.sql
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
    const physicalTableName = tableName(table)
    const uniqueConstraints = new Map<string, UniqueConstraint>()
    for (const [rule, fields] of Object.entries(object.uniqueBy)) {
      uniqueConstraints.set(
        objectUniqueConstraintName(physicalTableName, rule),
        {
          fields,
          rule,
        }
      )
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
    const interfaceTables: ReadonlyArray<Table<{ id: string }>> = Object.values(
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
    const storageColumns: Readonly<Record<string, Column>> = tableColumns(table)
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
      aliases: sqlValue<ReadonlyArray<RecordAlias>>(sql`array(
        select ${recordAliases.columns.alias}

          from ${recordAliases}

          where ${recordAliases.columns.objectId} = ${objects.columns.id}

          order by ${recordAliases.columns.alias}
      )`),
      metadata: objects.columns.metadata,
      createdAtCursor: sqlValue<string>(
        sql`${objects.columns.createdAt}::text`
      ),
      updatedAtCursor: sqlValue<string>(
        sql`${objects.columns.updatedAt}::text`
      ),
      createdAt: objects.columns.createdAt,
      createdBy: objects.columns.createdById,
      etag: objects.columns.etag,
      parent: objects.columns.parentId,
      systemManaged: objects.columns.systemManaged,
      updatedAt: objects.columns.updatedAt,
      updatedBy: objects.columns.updatedById,
    }

    const queryColumns = {
      ...columns,
      createdAt: objects.columns.createdAt,
      createdBy: objects.columns.createdById,
      id: idColumn,
      parent: objects.columns.parentId,
      systemManaged: objects.columns.systemManaged,
      updatedAt: objects.columns.updatedAt,
      updatedBy: objects.columns.updatedById,
    }

    const { compileFilter, resolveSort } = makeObjectQueryCompiler(
      sql,
      object,
      queryColumns
    )

    const select = (
      where?: Fragment,
      orderBy: ReadonlyArray<Fragment> = [sql`${idColumn} asc`],
      limit?: number
    ) =>
      sql<SelectionRow<typeof selection>>`select ${projection(selection)}
          from ${table}

          inner join ${objects} on ${idColumn} = ${objects.columns.id}

          where ${where ?? sql.literal("true")}
          order by ${sql.csv(orderBy)}
        ${limit === undefined ? sql.literal("") : sql`limit ${limit}`}`
    const countMatching = (where?: Fragment, includeCoreObjects = true) =>
      sql<{
        totalSize: number
      }>`select count(*)::double precision as "totalSize"
          from ${table}
        ${includeCoreObjects ? sql`inner join ${objects} on ${idColumn} = ${objects.columns.id}` : sql.literal("")}

          where ${where ?? sql.literal("true")}`

    const decodeRecord = Schema.decodeUnknownEffect(RecordSchema)
    const decodeRecords = Schema.decodeUnknownEffect(RecordsSchema)

    const get = Effect.fn(`${object.id}.repository.get`)(function* (
      id: RecordId<TObject["id"]>
    ) {
      const rows = yield* select(sql`${idColumn} = ${id}`, undefined, 1)
      const row = rows[0]
      if (row === undefined) return yield* Effect.fail(notFound(object, id))
      return yield* decodeRecord(row)
    })

    const batchGet = Effect.fn(`${object.id}.repository.batchGet`)(function* (
      ids: ReadonlyArray<RecordId<TObject["id"]>>
    ) {
      if (ids.length === 0) return []

      const records = yield* select(inValues(sql, idColumn, ids)).pipe(
        Effect.flatMap((rows) => decodeRecords(rows))
      )
      const byId = new Map(records.map((record) => [record.id, record]))
      const missing = ids.find((id) => !byId.has(id))
      if (missing !== undefined)
        return yield* Effect.fail(notFound(object, missing))

      return ids.map((id) => byId.get(id)!)
    })

    const makeList = (pageTokens: PageTokenCodec) =>
      Effect.fn(`${object.id}.repository.list`)(function* (
        request: RepositoryListRequest<TObject> = {}
      ): Effect.fn.Return<
        Page<ObjectRecord<TObject>>,
        PostgresRepositoryError
      > {
        const size = yield* Effect.try({
          try: () => normalizePageSize(request.pageSize),
          catch: () =>
            invalidListRequest(
              object,
              "pageSize must be a non-negative integer."
            ),
        })
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
        const fingerprint = cursorFingerprint(object, request, publicSort)
        const cursor =
          request.pageToken === undefined
            ? undefined
            : yield* Effect.try({
                try: () =>
                  decodeCursor(
                    object,
                    pageTokens,
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
            : cursorCondition(sql, resolvedSort, cursor.values)
        let related
        if (request.relatedTo !== undefined) {
          const { linkId, direction, sourceId } = request.relatedTo
          const edge = storage.linkTables[linkId]
          if (edge === undefined)
            return yield* Effect.fail(
              invalidListRequest(object, "Unknown relationship.")
            )
          const edgeColumns = tableColumns(edge)
          const source =
            edgeColumns[direction === "forward" ? "forwardId" : "reverseId"]
          const target =
            edgeColumns[direction === "forward" ? "reverseId" : "forwardId"]
          related = sql`exists (select 1
          from ${edge}
          where ${source} = ${sourceId} and ${target} = ${idColumn})`
        }
        const matching = sql.and(
          [filter, related].filter((part) => part !== undefined)
        )
        const rows = yield* select(
          sql.and([matching, after].filter((part) => part !== undefined)),
          resolvedSort.map((sort) => orderExpression(sql, sort)),
          size + 1
        )
        const records = yield* decodeRecords(rows)
        const hasNextPage = records.length > size
        const items = hasNextPage ? records.slice(0, size) : records
        const last = items.at(-1)
        const totalSize =
          request.pageToken === undefined && !hasNextPage
            ? items.length
            : ((yield* countMatching(
                matching,
                filter !== undefined || related !== undefined
              ))[0]?.totalSize ?? 0)
        return {
          items,
          nextPageToken:
            hasNextPage && last !== undefined
              ? encodeCursor(pageTokens, {
                  fingerprint,
                  // Preserve PostgreSQL timestamp precision across page boundaries.
                  values: resolvedSort.map(({ field }) =>
                    field === "createdAt"
                      ? rows[items.length - 1]!.createdAtCursor
                      : field === "updatedAt"
                        ? rows[items.length - 1]!.updatedAtCursor
                        : recordValue(last, field)
                  ),
                  version: 1,
                })
              : null,
          totalSize,
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

      yield* Effect.gen(function* () {
        const parentRowsFields = {
          objectType: objects.columns.objectType,
        }
        const parentRows = yield* sql<
          SelectionRow<typeof parentRowsFields>
        >`select ${projection(parentRowsFields)}
          from ${objects}
          where ${objects.columns.id} = ${parentId}
          limit ${1}`
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
            ? (yield* sql<{
                present: number
              }>`select 1 as present
          from ${parentInterfaceTable}
          where ${parentInterfaceTable.columns.id} = ${parentId}
          limit ${1}`).length === 1
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

        yield* sql`insert into ${objects} ${insertValues(sql, objects, {
          metadata,
          createdById: createdBy,
          id,
          objectType: object.id,
          parentId,
          systemManaged,
          updatedById: updatedBy,
        })}`
        if (aliases.length > 0) {
          yield* sql`insert into ${recordAliases} ${insertValues(
            sql,
            recordAliases,
            aliases.map((alias) => ({ alias, objectId: id }))
          )}
          on conflict do nothing`
          const ownersFields = {
            alias: recordAliases.columns.alias,
            objectId: recordAliases.columns.objectId,
          }
          const owners = yield* sql<
            SelectionRow<typeof ownersFields>
          >`select ${projection(ownersFields)}
          from ${recordAliases}
          where ${inValues(sql, recordAliases.columns.alias, [...aliases])}`
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
        yield* sql`insert into ${table} ${insertValues(sql, table, objectValues)}`
        for (const interfaceTable of interfaceTables) {
          yield* sql`insert into ${interfaceTable} ${insertValues(sql, interfaceTable, { id })}`
        }
        return undefined
      }).pipe((effect) =>
        translateUniqueConflict(effect, object, uniqueConstraints)
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

      yield* Effect.gen(function* () {
        const parentRowsFields2 = {
          objectType: objects.columns.objectType,
        }
        const parentRows = yield* sql<
          SelectionRow<typeof parentRowsFields2>
        >`select ${projection(parentRowsFields2)}
          from ${objects}
          where ${objects.columns.id} = ${parentId}
          limit ${1}`
        const parent = parentRows[0]
        if (parent === undefined) {
          return yield* Effect.fail(
            new ObjectParentNotFound({ objectType: object.id, parentId })
          )
        }
        const parentMatches =
          parentInterfaceTable !== undefined
            ? (yield* sql<{
                present: number
              }>`select 1 as present
          from ${parentInterfaceTable}
          where ${parentInterfaceTable.columns.id} = ${parentId}
          limit ${1}`).length === 1
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

        const existingRowsFields = {
          objectType: objects.columns.objectType,
          parentId: objects.columns.parentId,
        }
        const existingRows = yield* sql<
          SelectionRow<typeof existingRowsFields>
        >`select ${projection(existingRowsFields)}
          from ${objects}
          where ${objects.columns.id} = ${id}
          limit ${1}`
        const existing = existingRows[0]
        if (
          existing !== undefined &&
          (existing.objectType !== object.id || existing.parentId !== parentId)
        ) {
          return yield* Effect.fail(conflict(object, id))
        }

        yield* sql`insert into ${objects} ${insertValues(sql, objects, {
          metadata,
          createdById: createdBy,
          id,
          objectType: object.id,
          parentId,
          systemManaged,
          updatedById: updatedBy,
        })}
          on conflict (${conflictColumns(sql, objects.columns.id)})
          do update set ${assignments(sql, objects, {
            metadata,
            etag: sql`(${objects.columns.etag}::numeric + 1)::text`,
            systemManaged,
            updatedAt: sql`now()`,
            updatedById: updatedBy,
          })}`

        if (aliases.length > 0) {
          yield* sql`insert into ${recordAliases} ${insertValues(
            sql,
            recordAliases,
            aliases.map((alias) => ({ alias, objectId: id }))
          )}
          on conflict do nothing`
          const ownersFields2 = {
            alias: recordAliases.columns.alias,
            objectId: recordAliases.columns.objectId,
          }
          const owners = yield* sql<
            SelectionRow<typeof ownersFields2>
          >`select ${projection(ownersFields2)}
          from ${recordAliases}
          where ${inValues(sql, recordAliases.columns.alias, [...aliases])}`
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
        yield* sql`delete
          from ${recordAliases}
          where ${recordAliases.columns.objectId} = ${id}
            and ${inValues(sql, recordAliases.columns.alias, aliases, true)}`

        const storageProperties = toStorageProperties(properties)
        const objectValues = { id, ...storageProperties, parentId }
        const onConflict =
          Object.keys(storageProperties).length === 0
            ? sql`on conflict do nothing`
            : sql`on conflict (${conflictColumns(sql, idColumn)})
          do update set ${assignments(sql, table, storageProperties)}`
        yield* sql`insert into ${table} ${insertValues(sql, table, objectValues)} ${onConflict}`
        for (const interfaceTable of interfaceTables) {
          yield* sql`insert into ${interfaceTable} ${insertValues(sql, interfaceTable, { id })}
          on conflict do nothing`
        }
        return undefined
      }).pipe((effect) =>
        translateUniqueConflict(effect, object, uniqueConstraints)
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
      yield* Effect.gen(function* () {
        const updatedFields = { id: objects.columns.id }
        const updated = yield* sql<
          SelectionRow<typeof updatedFields>
        >`update ${objects} set ${assignments(
          sql,
          objects,
          metadata === undefined
            ? {
                etag: sql`(${objects.columns.etag}::numeric + 1)::text`,
                updatedAt: sql`now()`,
                updatedById: updatedBy,
              }
            : {
                etag: sql`(${objects.columns.etag}::numeric + 1)::text`,
                metadata,
                updatedAt: sql`now()`,
                updatedById: updatedBy,
              }
        )}
          where (${objects.columns.id} = ${id} and ${objects.columns.objectType} = ${object.id} and ${objects.columns.etag} = ${etag})
          returning ${projection(updatedFields)}`
        if (updated.length === 0)
          return yield* Effect.fail(conflict(object, id))

        const aliasesToAdd =
          aliases === undefined
            ? []
            : isAliasReplacement(aliases)
              ? aliases
              : (aliases.add ?? [])
        if (aliasesToAdd.length > 0) {
          yield* sql`insert into ${recordAliases} ${insertValues(
            sql,
            recordAliases,
            aliasesToAdd.map((alias) => ({ alias, objectId: id }))
          )}
          on conflict do nothing`
          const ownersFields3 = {
            alias: recordAliases.columns.alias,
            objectId: recordAliases.columns.objectId,
          }
          const owners = yield* sql<
            SelectionRow<typeof ownersFields3>
          >`select ${projection(ownersFields3)}
          from ${recordAliases}
          where ${inValues(sql, recordAliases.columns.alias, [...aliasesToAdd])}`
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
            yield* sql`delete
          from ${recordAliases}
          where ${recordAliases.columns.objectId} = ${id}
            and ${inValues(sql, recordAliases.columns.alias, aliases, true)}`
          } else {
            const aliasesToRemove = aliases.remove ?? []
            if (aliasesToRemove.length > 0) {
              yield* sql`delete
          from ${recordAliases}
          where (${recordAliases.columns.objectId} = ${id} and ${inValues(sql, recordAliases.columns.alias, [...aliasesToRemove])})`
            }
          }
        }

        if (Object.keys(storageProperties).length > 0) {
          yield* sql`update ${table} set ${assignments(sql, table, storageProperties)}
          where ${idColumn} = ${id}`
        }
        return undefined
      }).pipe((effect) =>
        translateUniqueConflict(effect, object, uniqueConstraints)
      )

      return yield* get(id)
    })

    const deleteObject = Effect.fn(`${object.id}.repository.delete`)(
      function* ({ etag, id }: ObjectDeleteTarget<TObject>) {
        const deletedFields = { id: objects.columns.id }
        const deleted = yield* sql<SelectionRow<typeof deletedFields>>`delete
          from ${objects}
          where (${objects.columns.id} = ${id} and ${objects.columns.objectType} = ${object.id} and ${objects.columns.etag} = ${etag})
          returning ${projection(deletedFields)}`.pipe((effect) =>
          translateDeleteRestriction(effect, object, [id])
        )
        if (deleted.length === 0)
          return yield* Effect.fail(conflict(object, id))
        return undefined
      }
    )

    const batchDelete = Effect.fn(`${object.id}.repository.batchDelete`)(
      function* (targets: ReadonlyArray<ObjectDeleteTarget<TObject>>) {
        if (targets.length === 0) return undefined

        yield* Effect.gen(function* () {
          const targetCondition = sql.join(
            " OR ",
            true,
            "false"
          )(
            targets
              .map(
                ({ etag, id }) =>
                  sql`(${objects.columns.id} = ${id} and ${objects.columns.etag} = ${etag})`
              )
              .filter((part) => part !== undefined)
          )
          const deletedFields2 = { id: objects.columns.id }
          const deleted = yield* sql<SelectionRow<typeof deletedFields2>>`delete
          from ${objects}
          where ${sql.and([sql`${objects.columns.objectType} = ${object.id}`, targetCondition].filter((part) => part !== undefined))}
          returning ${projection(deletedFields2)}`
          const deletedIds = new Set(deleted.map(({ id }) => id))
          const conflictTarget = targets.find(({ id }) => !deletedIds.has(id))
          if (conflictTarget !== undefined) {
            return yield* Effect.fail(conflict(object, conflictTarget.id))
          }
          return undefined
        }).pipe((effect) =>
          translateDeleteRestriction(
            effect,
            object,
            targets.map(({ id }) => id)
          )
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
      makeList,
      update,
      upsert,
    }
  })
}

/**
 * Builds the PostgreSQL persistence for one semantic object. It receives values
 * already validated by a governed service and owns storage translation, record
 * tags, timestamps, concurrency checks, and integrity translation. Multi-statement
 * writes assume the caller holds the transaction; `Records` supplies it together
 * with event recording.
 */
export function makeObjectRepository<
  const TModel extends ModelCatalog,
  const TObject extends ObjectType,
>(
  storage: PostgresStorage<TModel>,
  object: TObject,
  db: PostgresDatabase,
  pageTokens: PageTokenCodec
) {
  return makeRepository(storage, object, db).pipe(
    Effect.map(({ makeList, ...repository }) => ({
      ...repository,
      list: makeList(pageTokens),
    }))
  )
}

/** Builds the idempotent upsert used by trusted system seeds. */
export function makeObjectSeedRepository<
  const TModel extends ModelCatalog,
  const TObject extends TModel["objects"][keyof TModel["objects"] & string],
>(storage: PostgresStorage<TModel>, object: TObject, db: PostgresDatabase) {
  return makeRepository(storage, object, db).pipe(
    Effect.map(({ upsert }) => ({ upsert }))
  )
}
