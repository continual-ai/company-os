import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PageToken,
  type Etag,
  type ListRequest,
  type ObjectRecord,
  type ObjectType,
  type ObjectUpdateInput,
  type Page,
  type RecordId,
} from "@continual/runtime"
import { toEffectObjectSchema } from "@continual/runtime/effect"
import {
  ObjectNotFound,
  ObjectParentNotFound,
  ObjectParentTypeMismatch,
  ObjectWriteConflict,
  type ObjectInsert,
  type ObjectUpdateMetadata,
  type Repository,
} from "@continual/runtime/effect/object-repository"
import {
  and,
  asc,
  eq,
  getTableColumns,
  gt,
  inArray,
  type SQL,
} from "drizzle-orm"
import type { EffectDrizzleQueryError } from "drizzle-orm/effect-core/errors"
import type {
  AnyPgTable,
  PgInsertValue,
  PgUpdateSetSource,
} from "drizzle-orm/pg-core"
import { Effect, Schema } from "effect"
import type { SqlError } from "effect/unstable/sql/SqlError"

import { Database } from "./drizzle.server"
import { objects } from "./schema/objects"

type RepositoryError =
  | EffectDrizzleQueryError
  | ObjectNotFound
  | ObjectParentNotFound
  | ObjectParentTypeMismatch
  | ObjectWriteConflict
  | Schema.SchemaError
  | SqlError

type StoredObjectId = (typeof objects.$inferInsert)["kind"]

interface ObjectRepository<TObject extends ObjectType> extends Repository<
  TObject,
  RepositoryError
> {
  /** Runs a typed, kind-table predicate through the standard object hydration. */
  readonly findManyWhere: (
    where: SQL
  ) => Effect.Effect<ReadonlyArray<ObjectRecord<TObject>>, RepositoryError>
}

function notFound(object: ObjectType, id: string) {
  return new ObjectNotFound({ objectId: object.id, recordId: id })
}

function conflict(object: ObjectType, id: string) {
  return new ObjectWriteConflict({ objectId: object.id, recordId: id })
}

/**
 * Builds the standard repository for one semantic object and its Drizzle
 * storage table. Company-specific repositories may add typed queries to the
 * returned capability without bypassing its hydration and write invariants.
 */
export function make<const TObject extends ObjectType<StoredObjectId>>(
  object: TObject,
  table: AnyPgTable
): Effect.Effect<ObjectRepository<TObject>, never, Database> {
  return Effect.gen(function* () {
    const db = yield* Database
    const columns = getTableColumns(table)
    const idColumn = columns.id
    if (idColumn === undefined) {
      return yield* Effect.die(
        `Storage table for object '${object.id}' must declare an id column.`
      )
    }
    const RecordSchema = toEffectObjectSchema(object)
    const RecordsSchema = Schema.Array(RecordSchema)
    const selection = {
      ...columns,
      annotations: objects.annotations,
      createdAt: objects.createdAt,
      createdById: objects.createdById,
      etag: objects.etag,
      parentId: objects.parentId,
      updatedAt: objects.updatedAt,
      updatedById: objects.updatedById,
    }

    const select = (where?: SQL) => {
      // SAFETY: the runtime check above proves this generic table has a
      // selectable ID column; Drizzle RC cannot express that generic fact.
      const query = db
        .select(selection)
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        .from(table as never)
        .innerJoin(objects, eq(idColumn, objects.id))
        .orderBy(asc(idColumn))
      return where === undefined ? query : query.where(where)
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
      request: ListRequest = {}
    ): Effect.fn.Return<Page<ObjectRecord<TObject>>, RepositoryError> {
      const size = Math.min(
        MAX_PAGE_SIZE,
        Math.max(1, request.pageSize ?? DEFAULT_PAGE_SIZE)
      )
      const query =
        request.pageToken === undefined
          ? select()
          : select(gt(idColumn, request.pageToken))
      const records = yield* query
        .limit(size + 1)
        .pipe(Effect.flatMap(decodeRecords))
      const hasNextPage = records.length > size
      const items = hasNextPage ? records.slice(0, size) : records
      return {
        items,
        nextPageToken: hasNextPage ? PageToken(items.at(-1)!.id) : "",
      }
    })

    const findManyWhere = Effect.fn(`${object.id}.repository.findManyWhere`)(
      function* (where: SQL) {
        return yield* select(where).pipe(Effect.flatMap(decodeRecords))
      }
    )

    const insert = Effect.fn(`${object.id}.repository.insert`)(function* (
      record: ObjectInsert<TObject>
    ) {
      const {
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
            .select({ ancestorIds: objects.ancestorIds, kind: objects.kind })
            .from(objects)
            .where(eq(objects.id, parentId))
            .limit(1)
          const parent = parentRows[0]
          if (parent === undefined) {
            return yield* Effect.fail(
              new ObjectParentNotFound({
                objectId: object.id,
                parentId,
              })
            )
          }
          if (parent.kind !== object.parent.objectId) {
            return yield* Effect.fail(
              new ObjectParentTypeMismatch({
                actualParentObjectId: parent.kind,
                expectedParentObjectId: object.parent.objectId,
                objectId: object.id,
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
            kind: object.id,
            parentId,
            updatedAt,
            updatedById,
          })
          // SAFETY: the portable object schema validates the property values,
          // while this factory is explicitly paired with that object's table.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const kindRow = {
            id,
            ...properties,
          } as PgInsertValue<typeof table>
          yield* tx.insert(table).values(kindRow)
          return undefined
        })
      )

      return yield* get(id)
    })

    const update = Effect.fn(`${object.id}.repository.update`)(function* (
      id: RecordId<TObject["id"]>,
      input: ObjectUpdateInput<TObject>,
      expectedEtag: Etag,
      metadata: ObjectUpdateMetadata
    ) {
      const { annotations, ...properties } = input
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
                eq(objects.kind, object.id),
                eq(objects.etag, expectedEtag)
              )
            )
            .returning({ id: objects.id })
          if (updated.length === 0)
            return yield* Effect.fail(conflict(object, id))

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
            eq(objects.kind, object.id),
            eq(objects.etag, expectedEtag)
          )
        )
        .returning({ id: objects.id })
      if (deleted.length === 0) return yield* Effect.fail(conflict(object, id))
      return undefined
    })

    return {
      batchGet,
      delete: deleteObject,
      findManyWhere,
      get,
      insert,
      list,
      update,
    }
  })
}
