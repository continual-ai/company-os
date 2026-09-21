import { Cause, Effect, Option, Schema } from "effect"
import { isSqlError, type SqlError } from "effect/unstable/sql/SqlError"
import type { Fragment } from "effect/unstable/sql/Statement"

import {
  toEffectObjectFields,
  toEffectObjectSchema,
} from "#/runtime/contract/schema.ts"
import { modelObjectLinkTraversals } from "#/runtime/model/definition/model.ts"
import type {
  BaseRecord,
  ObjectCreateValues,
  ObjectUpdateValues,
} from "#/runtime/model/definition/object.ts"
import type {
  CanonicalListRequest,
  CanonicalObjectFilter,
} from "#/runtime/model/definition/request.ts"
import {
  Etag,
  type InferProperty,
  type InferProperties,
  type ModelCatalog,
  type ObjectRecord,
  type ObjectType,
  type Page,
  type PageTokenCodec,
  type RecordAlias,
  type RecordAliasUpdate,
  type RecordId,
} from "#/runtime/model/index.ts"
import {
  ObjectNotFound,
  ObjectWriteConflict,
  ObjectDeleteRestricted,
  type ObjectUniqueConflict,
  type InvalidListRequest,
  RecordAliasConflict,
} from "#/runtime/server/errors.ts"
import {
  boundedCount,
  countSummary,
  COUNT_LIMIT,
} from "#/runtime/server/storage/count.ts"
import {
  prepareListQuery,
  encodeCursor,
  invalidListRequest,
  makeObjectQueryCompiler,
  orderExpression,
  type ResolvedSort,
} from "#/runtime/server/storage/object-query.ts"
import { recordLabelSql } from "#/runtime/server/storage/record-label.ts"
import {
  RecordSecrets,
  redactRecordSecrets,
} from "#/runtime/server/storage/record-secrets.ts"
import { relationalQuery } from "#/runtime/server/storage/relational-query.ts"
import type { PostgresStorage } from "#/runtime/server/storage/schema.ts"
import {
  assignments,
  conflictColumns,
  insertValues,
  inValues,
  projection,
  sqlValue,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import {
  tableColumns,
  type Column,
  type Table,
} from "#/runtime/server/storage/table.ts"
import { type PostgresDatabase } from "#/runtime/server/storage/transactions.ts"

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
  "aliases" | "metadata" | "createdBy" | "id" | "systemManaged" | "updatedBy"
>

type ObjectUpdatePropertyValues<TObject extends ObjectType> = Omit<
  ObjectRepositoryUpdate<TObject>,
  "aliases" | "etag" | "id" | "metadata" | "updatedBy"
>

type CanonicalStoragePropertyValues<TObject extends ObjectType> =
  | ObjectInsertPropertyValues<TObject>
  | ObjectUpdatePropertyValues<TObject>

export type StoredRecord<O extends ObjectType> = Omit<
  BaseRecord<O["id"]>,
  "links" | "label"
> &
  InferProperties<O["properties"]>

/** Resolved reference columns keyed by their physical object or interface table. */
export type InitialReferences = Readonly<
  Record<string, Readonly<Record<string, string>>>
>

/** Canonical insert values; persistence supplies the tag and timestamps. */
export type ObjectInsert<TObject extends ObjectType> = Omit<
  BaseRecord<TObject["id"]>,
  "createdAt" | "etag" | "updatedAt" | "links" | "objectType" | "label"
> &
  ObjectCreateValues<TObject>

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

type PostgresRepositoryError =
  | InvalidListRequest
  | RecordAliasConflict
  | ObjectNotFound
  | ObjectDeleteRestricted
  | ObjectUniqueConflict
  | ObjectWriteConflict
  | Schema.SchemaError
  | SqlError

function wrappedSqlError(error: unknown): SqlError | undefined {
  if (isSqlError(error)) return error
  if (Cause.isCause(error)) {
    return wrappedSqlError(Option.getOrUndefined(Cause.findErrorOption(error)))
  }
  return undefined
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
    const propertyColumns = Object.fromEntries(
      Object.entries(object.properties).map(([propertyId]) => {
        const storageKey = propertyId
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
      properties: CanonicalStoragePropertyValues<TObject>,
      id: string
    ): StoragePropertyValues<TObject> =>
      // SAFETY: the schema-directed codec retains column keys and substitutes JSONB envelopes for secret leaves.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      secrets.encrypt(object, id, properties) as StoragePropertyValues<TObject>
    const secrets = yield* RecordSecrets
    const RecordSchema = toEffectObjectSchema(object)
    const RecordsSchema = Schema.Array(RecordSchema)
    // SAFETY: the same model fields and codecs as the public record, excluding computed read projections.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const StoredSchema = Schema.Struct(
      Object.fromEntries(
        Object.entries(toEffectObjectFields(object)).filter(
          ([key]) => key !== "links" && key !== "label"
        )
      )
    ) as unknown as Schema.Codec<StoredRecord<TObject>, unknown>
    const linkPreviews = modelObjectLinkTraversals(storage.model, object).map(
      ({ link, direction, traversal }) => {
        const edges = storage.linkTables[link.id]!
        const source =
          direction === "forward"
            ? edges.columns.forwardId
            : edges.columns.reverseId
        const target =
          direction === "forward"
            ? edges.columns.reverseId
            : edges.columns.forwardId
        if (traversal.max === 1)
          return sql`${traversal.key}::text, (select ${target} from ${edges} where ${source} = ${objects.columns.id})`
        // OFFSET 0 keeps the shared count subquery from being duplicated for its two output fields.
        return sql`${traversal.key}::text, (select jsonb_build_object('ids', array(select ${target} from ${edges} where ${source} = ${objects.columns.id} order by ${target} limit 3), 'totalSize', least(matches, ${COUNT_LIMIT}), 'totalSizeExact', matches <= ${COUNT_LIMIT}) from (select ${boundedCount(sql, sql`from ${edges} where ${source} = ${objects.columns.id}`)} as matches offset 0) summary)`
      }
    )
    const label = recordLabelSql(sql, storage, object)
    const selection = {
      label: sqlValue<string>(label),
      ...columns,
      objectType: objects.columns.objectType,
      links: sqlValue<ObjectRecord<TObject>["links"]>(
        sql`jsonb_build_object(${sql.csv(linkPreviews)})`
      ),
      aliases: sqlValue<ReadonlyArray<RecordAlias>>(sql`array(
        select ${recordAliases.columns.alias}

          from ${recordAliases}

          where ${recordAliases.columns.objectId} = ${objects.columns.id}

          order by ${recordAliases.columns.alias}
      )`),
      metadata: objects.columns.metadata,
      createdAt: objects.columns.createdAt,
      createdBy: objects.columns.createdById,
      etag: objects.columns.etag,
      systemManaged: objects.columns.systemManaged,
      updatedAt: objects.columns.updatedAt,
      updatedBy: objects.columns.updatedById,
    }

    const { links: _links, label: _label, ...storedSelection } = selection

    const queryColumns = {
      label: Object.assign(label, { name: "label", type: "text" }),
      ...Object.fromEntries(
        Object.entries(columns).filter(([key]) =>
          Object.hasOwn(object.properties, key)
        )
      ),
      createdAt: objects.columns.createdAt,
      createdBy: objects.columns.createdById,
      id: idColumn,
      systemManaged: objects.columns.systemManaged,
      updatedAt: objects.columns.updatedAt,
      updatedBy: objects.columns.updatedById,
    }

    const relations = relationalQuery(sql, storage, object, idColumn)
    const compiler = makeObjectQueryCompiler(
      sql,
      object,
      queryColumns,
      relations.filter,
      relations.field
    )

    const select = (
      where?: Fragment,
      orderBy: ReadonlyArray<Fragment> = [sql`${idColumn} asc`],
      limit?: number,
      cursorSort: ReadonlyArray<ResolvedSort> = [],
      offset = 0
    ) =>
      sql<
        SelectionRow<typeof selection> & {
          cursorValues: ReadonlyArray<string | null>
        }
      >`select ${projection(selection)}, jsonb_build_array(${sql.csv(cursorSort.map(({ column }) => sql`${column}::text`))}) as "cursorValues"
          from ${table}

          inner join ${objects} on ${idColumn} = ${objects.columns.id}

          where ${where ?? sql.literal("true")}
          order by ${sql.csv(orderBy)}
        ${limit === undefined ? sql.literal("") : sql`limit ${limit}`} offset ${offset}`
    const countMatching = (where?: Fragment, includeCoreObjects = true) =>
      sql<{
        totalSize: number
      }>`select ${boundedCount(
        sql,
        sql`from ${table}
        ${includeCoreObjects ? sql`inner join ${objects} on ${idColumn} = ${objects.columns.id}` : sql.literal("")}
          where ${where ?? sql.literal("true")}`
      )} as "totalSize"`

    const decodeRecord = (row: object) =>
      Schema.decodeUnknownEffect(RecordSchema)(redactRecordSecrets(object, row))
    const decodeRecords = (rows: ReadonlyArray<object>) =>
      Schema.decodeUnknownEffect(RecordsSchema)(
        rows.map((row) => redactRecordSecrets(object, row))
      )

    const get = Effect.fn(`${object.id}.repository.get`)(function* (
      id: RecordId<TObject["id"]>
    ) {
      const row = (yield* select(sql`${idColumn} = ${id}`, undefined, 1))[0]
      if (row === undefined) return yield* Effect.fail(notFound(object, id))
      return yield* decodeRecord(row)
    })

    const getStored = Effect.fn(`${object.id}.repository.getStored`)(function* (
      id: RecordId<TObject["id"]>
    ) {
      const [row] = yield* sql<
        SelectionRow<typeof storedSelection>
      >`select ${projection(storedSelection)}
        from ${table} inner join ${objects} on ${idColumn} = ${objects.columns.id}
        where ${idColumn} = ${id}`
      if (row === undefined) return yield* Effect.fail(notFound(object, id))
      return yield* Schema.decodeUnknownEffect(StoredSchema)(
        redactRecordSecrets(object, row)
      )
    })

    const getStates = Effect.fn(`${object.id}.repository.getStates`)(function* (
      ids: ReadonlyArray<RecordId<TObject["id"]>>
    ) {
      if (ids.length === 0) return []
      const fields = {
        id: objects.columns.id,
        etag: objects.columns.etag,
        systemManaged: objects.columns.systemManaged,
      }
      const rows = yield* sql<
        SelectionRow<typeof fields>
      >`select ${projection(fields)}
        from ${table} inner join ${objects} on ${idColumn} = ${objects.columns.id}
        where ${inValues(sql, idColumn, ids)}`
      const byId = new Map(rows.map((row) => [row.id, row]))
      const missing = ids.find((id) => !byId.has(id))
      if (missing !== undefined)
        return yield* Effect.fail(notFound(object, missing))
      return ids.map((id) => ({
        ...byId.get(id)!,
        id,
        etag: Etag(byId.get(id)!.etag),
      }))
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
        const {
          size,
          sort: resolvedSort,
          fingerprint,
          matching: predicates,
          after,
        } = yield* prepareListQuery(
          sql,
          object,
          idColumn,
          compiler,
          request,
          pageTokens
        )
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
          [predicates, related].filter((part) => part !== undefined)
        )
        const rows = yield* select(
          sql.and([matching, after].filter((part) => part !== undefined)),
          resolvedSort.map((sort) => orderExpression(sql, sort)),
          size + 1,
          resolvedSort,
          request.pageOffset ?? 0
        )
        const records = yield* decodeRecords(rows)
        const hasNextPage = records.length > size
        const items = hasNextPage ? records.slice(0, size) : records
        const last = items.at(-1)
        const totalSize =
          request.pageToken === undefined &&
          (request.pageOffset ?? 0) === 0 &&
          !hasNextPage
            ? items.length
            : ((yield* countMatching(
                matching,
                request.filter !== undefined || related !== undefined
              ))[0]?.totalSize ?? 0)
        return {
          items,
          nextPageToken:
            hasNextPage && last !== undefined
              ? encodeCursor(pageTokens, {
                  fingerprint,
                  values: rows[items.length - 1]!.cursorValues,
                  version: 1,
                })
              : null,
          ...countSummary(totalSize),
        }
      })

    const claimAliases = Effect.fn(`${object.id}.repository.claimAliases`)(
      function* (id: string, aliases: ReadonlyArray<RecordAlias>) {
        if (aliases.length === 0) return undefined
        yield* sql`insert into ${recordAliases} ${insertValues(
          sql,
          recordAliases,
          aliases.map((alias) => ({ alias, objectId: id }))
        )} on conflict do nothing`
        const fields = {
          alias: recordAliases.columns.alias,
          objectId: recordAliases.columns.objectId,
        }
        const owners = yield* sql<
          SelectionRow<typeof fields>
        >`select ${projection(fields)} from ${recordAliases}
        where ${inValues(sql, recordAliases.columns.alias, aliases)}`
        const conflictOwner = owners.find((owner) => owner.objectId !== id)
        if (conflictOwner !== undefined)
          return yield* Effect.fail(
            new RecordAliasConflict({
              alias: conflictOwner.alias,
              conflictingRecordId: conflictOwner.objectId,
              recordId: id,
            })
          )
        return undefined
      }
    )

    const insert = Effect.fn(`${object.id}.repository.insert`)(function* (
      record: ObjectInsert<TObject>,
      references: InitialReferences = {}
    ) {
      const {
        aliases,
        metadata,
        createdBy,
        id,
        systemManaged,
        updatedBy,
        ...properties
      } = record

      yield* Effect.gen(function* () {
        yield* sql`insert into ${objects} ${insertValues(sql, objects, {
          metadata,
          createdById: createdBy,
          id,
          objectType: object.id,
          systemManaged,
          updatedById: updatedBy,
        })}`
        yield* claimAliases(id, aliases)
        const objectValues = {
          id,
          ...toStorageProperties(properties, id),
          ...references[table.name],
        }
        yield* sql`insert into ${table} ${insertValues(sql, table, objectValues)}`
        for (const interfaceTable of interfaceTables) {
          yield* sql`insert into ${interfaceTable} ${insertValues(sql, interfaceTable, { id, ...references[interfaceTable.name] })}`
        }
        return undefined
      })

      return yield* getStored(id)
    })

    const upsert = Effect.fn(`${object.id}.repository.upsert`)(function* (
      record: ObjectInsert<TObject>
    ) {
      const {
        aliases,
        metadata,
        createdBy,
        id,
        systemManaged,
        updatedBy,
        ...properties
      } = record

      yield* Effect.gen(function* () {
        const existingRowsFields = {
          objectType: objects.columns.objectType,
        }
        const existingRows = yield* sql<
          SelectionRow<typeof existingRowsFields>
        >`select ${projection(existingRowsFields)}
          from ${objects}
          where ${objects.columns.id} = ${id}
          limit ${1}`
        const existing = existingRows[0]
        if (existing !== undefined && existing.objectType !== object.id) {
          return yield* Effect.fail(conflict(object, id))
        }

        yield* sql`insert into ${objects} ${insertValues(sql, objects, {
          metadata,
          createdById: createdBy,
          id,
          objectType: object.id,
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

        yield* claimAliases(id, aliases)
        yield* sql`delete
          from ${recordAliases}
          where ${recordAliases.columns.objectId} = ${id}
            and ${inValues(sql, recordAliases.columns.alias, aliases, true)}`

        const storageProperties = toStorageProperties(properties, id)
        const objectValues = { id, ...storageProperties }
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
      })

      return yield* getStored(id)
    })

    const update = Effect.fn(`${object.id}.repository.update`)(function* ({
      aliases,
      etag,
      id,
      metadata,
      updatedBy,
      ...properties
    }: ObjectRepositoryUpdate<TObject>) {
      const storageProperties = toStorageProperties(properties, id)
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
        yield* claimAliases(id, aliasesToAdd)

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
      })

      return yield* getStored(id)
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
      secretValues: Effect.fn(function* (
        id: string,
        keys: ReadonlyArray<string>
      ) {
        if (keys.length === 0) return {}
        const selected = Object.fromEntries(
          keys.map((key) => [key, propertyColumns[key]!])
        )
        const rows = yield* sql<
          Record<string, unknown>
        >`select ${projection(selected)} from ${table} where ${idColumn} = ${id}`
        return secrets.reveal(object, id, rows[0] ?? {})
      }),
      batchDelete,
      batchGet,
      delete: deleteObject,
      get,
      getStored,
      getStates,
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
