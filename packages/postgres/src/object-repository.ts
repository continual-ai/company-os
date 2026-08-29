import {
  normalizePageSize,
  RecordId,
  type RecordAlias,
  type RecordAliasUpdate,
  type ModelCatalog,
  type ModelObjectRef,
  type PageTokenCodec,
  type InferProperty,
  type ObjectRecord,
  type ObjectType,
  type Page,
  type ObjectRef,
} from "@company/runtime"
import { toEffectObjectSchema } from "@company/runtime/effect"
import {
  ObjectNotFound,
  ObjectDeleteRestricted,
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
  type Repository,
} from "@company/runtime/effect/object-repository"
import {
  and,
  asc,
  count,
  eq,
  getTableName,
  getTableColumns,
  inArray,
  notInArray,
  or,
  sql,
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
  cursorCondition,
  cursorFingerprint,
  decodeCursor,
  encodeCursor,
  invalidListRequest,
  makeObjectQueryCompiler,
  orderExpression,
  recordValue,
} from "./object-query"
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
  | ObjectDeleteRestricted
  | ObjectParentNotFound
  | ObjectParentTypeMismatch
  | ObjectUniqueConflict
  | ObjectWriteConflict
  | Schema.SchemaError
  | SqlError

export type PostgresRecordAliasResolutionError =
  | EffectDrizzleQueryError
  | RecordAliasNotFound

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

function makeRepository<
  const TModel extends ModelCatalog,
  const TObject extends TModel["objects"][keyof TModel["objects"] & string],
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  object: TObject,
  db: EffectPgDatabase<TRelations>
) {
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

    const { compileFilter, resolveSort } = makeObjectQueryCompiler(
      object,
      queryColumns
    )

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

    const countMatching = (where?: SQL, includeCoreObjects = true) => {
      const query = db.select({ totalSize: count() })
      if (!includeCoreObjects) {
        // SAFETY: the runtime check above proves this generic table is selectable;
        // Drizzle RC cannot express that generic fact.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const objectQuery = query.from(table as never)
        return where === undefined ? objectQuery : objectQuery.where(where)
      }
      // SAFETY: the runtime check above proves this generic table is selectable;
      // Drizzle RC cannot express that generic fact.
      const joinedQuery = query
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        .from(table as never)
        .innerJoin(objects, eq(idColumn, objects.id))
      return where === undefined ? joinedQuery : joinedQuery.where(where)
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
        request: RepositoryListRequest<TObject> = {},
        visibility?: RepositoryListVisibility
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
        const matching = and(filter, visible)
        const records = yield* select(
          and(matching, after),
          resolvedSort.map(orderExpression)
        )
          .limit(size + 1)
          .pipe(Effect.flatMap((rows) => decodeRecords(rows)))
        const hasNextPage = records.length > size
        const items = hasNextPage ? records.slice(0, size) : records
        const last = items.at(-1)
        const totalSize =
          request.pageToken === undefined && !hasNextPage
            ? items.length
            : ((yield* countMatching(
                matching,
                filter !== undefined || visible !== undefined
              ))[0]?.totalSize ?? 0)
        return {
          items,
          nextPageToken:
            hasNextPage && last !== undefined
              ? encodeCursor(pageTokens, {
                  fingerprint,
                  values: resolvedSort.map(({ field }) =>
                    recordValue(last, field)
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
          const objectRow = objectValues as PgInsertValue<typeof table>
          yield* tx.insert(table).values(objectRow)
          for (const interfaceTable of interfaceTables) {
            // SAFETY: interface storage tables are ID-only projections whose
            // rows are transactionally derived from declared implementations.
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
          const objectRow = objectValues as PgInsertValue<typeof table>
          const inserted = tx.insert(table).values(objectRow)
          if (Object.keys(storageProperties).length === 0) {
            yield* inserted.onConflictDoNothing()
          } else {
            // SAFETY: the complete seed record carries this object's canonical
            // property values and never changes its semantic parent.
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion
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
              // oxlint-disable-next-line typescript/no-unsafe-type-assertion
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
          .pipe((effect) => translateDeleteRestriction(effect, object, [id]))
        if (deleted.length === 0)
          return yield* Effect.fail(conflict(object, id))
        return undefined
      }
    )

    const batchDelete = Effect.fn(`${object.id}.repository.batchDelete`)(
      function* (targets: ReadonlyArray<ObjectDeleteTarget<TObject>>) {
        if (targets.length === 0) return undefined

        yield* db
          .transaction((tx) =>
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
              const conflictTarget = targets.find(
                ({ id }) => !deletedIds.has(id)
              )
              if (conflictTarget !== undefined) {
                return yield* Effect.fail(conflict(object, conflictTarget.id))
              }
              return undefined
            })
          )
          .pipe((effect) =>
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
 * Builds the standard repository for one semantic object and its Drizzle
 * storage table. Application-specific repositories may add typed queries to the
 * returned capability without bypassing its hydration and write invariants.
 */
export function makeObjectRepository<
  const TModel extends ModelCatalog,
  const TObject extends TModel["objects"][keyof TModel["objects"] & string],
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  object: TObject,
  db: EffectPgDatabase<TRelations>,
  pageTokens: PageTokenCodec
): Effect.Effect<Repository<TObject, PostgresRepositoryError>> {
  return makeRepository(storage, object, db).pipe(
    Effect.map(({ makeList, ...repository }) => ({
      ...repository,
      list: makeList(pageTokens),
    }))
  )
}

/** Builds the idempotent upsert capability used by trusted system seeds. */
export function makeObjectSeedRepository<
  const TModel extends ModelCatalog,
  const TObject extends TModel["objects"][keyof TModel["objects"] & string],
  const TRelations extends AnyRelations,
>(
  storage: PostgresStorage<TModel>,
  object: TObject,
  db: EffectPgDatabase<TRelations>
): Effect.Effect<Pick<Repository<TObject, PostgresRepositoryError>, "upsert">> {
  return makeRepository(storage, object, db).pipe(
    Effect.map(({ upsert }) => ({ upsert }))
  )
}
