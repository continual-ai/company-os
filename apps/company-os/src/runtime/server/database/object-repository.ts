import { Effect } from "effect"

import { replaceAssetReferences } from "#/runtime/assets/server/asset-references.ts"
import { compileAssetReferences } from "#/runtime/assets/server/references.ts"
import type { ObjectType } from "#/runtime/model/index.ts"
import { Database } from "#/runtime/server/database/database.ts"
import { deletionChanges } from "#/runtime/server/database/deletion-changes.ts"
import { updateSearchIndex } from "#/runtime/server/database/search-index.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import type { Repository } from "#/runtime/server/object-repository.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import {
  projection,
  type SelectionRow,
  inValues,
} from "#/runtime/server/postgres/index.ts"
import {
  makeObjectRepository as makePostgresObjectRepository,
  makeObjectSeedRepository as makePostgresObjectSeedRepository,
} from "#/runtime/server/postgres/index.ts"

type ModelObjectType = ObjectType

/** Builds a repository from the model-derived private storage projection. */
export function makeObjectRepository<const TObject extends ModelObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
    const context = yield* ModelContext
    const Storage = context.storage
    const database = yield* Database
    const sql = database.sql
    const pageTokens = yield* PageTokens
    const repository = yield* makePostgresObjectRepository(
      Storage,
      object,
      database,
      pageTokens
    )
    const events = makeEventWriter(database, context)
    const collectAssets = compileAssetReferences(object)
    const deleting = deletionChanges(database, object, context)
    const track = <
      A extends { readonly id: string; readonly updatedBy: string },
      E,
      R,
    >(
      operation: Effect.Effect<A, E, R>,
      kind: "created" | "updated"
    ) =>
      database.transaction(() =>
        Effect.gen(function* () {
          const record = yield* operation
          if (collectAssets !== undefined)
            yield* replaceAssetReferences(
              database,
              record.id,
              collectAssets(record),
              context
            )
          yield* events.record({
            type: `${object.id}.${kind}`,
            version: 1,
            data: record,
            subjects: yield* events.subjects([record.id]),
            actorId: record.updatedBy,
          })
          return record
        })
      )
    const remove = <A, E, R>(
      ids: ReadonlyArray<string>,
      operation: Effect.Effect<A, E, R>
    ) =>
      database.transaction(() =>
        Effect.gen(function* () {
          const core = Storage.core.objects
          const targetsFields = {
            id: core.columns.id,
            objectType: core.columns.objectType,
            ancestorIds: core.columns.ancestorIds,
            etag: core.columns.etag,
          }
          const targets =
            ids.length === 0
              ? []
              : yield* sql<
                  SelectionRow<typeof targetsFields>
                >`select ${projection(targetsFields)}
          from ${core}
          where ${inValues(sql, core.columns.id, [...ids])}
          order by ${sql.csv([core.columns.id])} for update`
          yield* deleting(ids)
          const result = yield* operation
          for (const target of targets)
            yield* events.record({
              type: `${object.id}.deleted`,
              version: 1,
              data: {
                id: target.id,
                etag: (BigInt(target.etag) + 1n).toString(),
              },
              subjects: [
                {
                  id: target.id,
                  objectType: target.objectType,
                  ancestorIds: target.ancestorIds,
                },
              ],
            })
          return result
        })
      )

    return {
      ...repository,
      insert: (input: Parameters<typeof repository.insert>[0]) =>
        track(repository.insert(input), "created"),
      update: (input: Parameters<typeof repository.update>[0]) =>
        track(repository.update(input), "updated"),
      delete: (input: Parameters<typeof repository.delete>[0]) =>
        remove([input.id], repository.delete(input)),
      batchDelete: (input: Parameters<typeof repository.batchDelete>[0]) =>
        remove(
          input.map((target) => target.id),
          repository.batchDelete(input)
        ),
      upsert: (input: Parameters<typeof repository.upsert>[0]) =>
        database.transaction(() =>
          Effect.gen(function* () {
            // Serialize concurrent upserts of the same identity before deciding its lifecycle event.
            yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`
            const existingFields = { id: Storage.core.objects.columns.id }
            const existing = yield* sql<
              SelectionRow<typeof existingFields>
            >`select ${projection(existingFields)}
          from ${Storage.core.objects}
          where ${Storage.core.objects.columns.id} = ${input.id}
          limit ${1}`
            return yield* track(
              repository.upsert(input),
              existing.length === 0 ? "created" : "updated"
            )
          })
        ),
    } satisfies Repository<TObject, unknown>
  })
}

/** Builds the narrow idempotent upsert capability used by system seeds. */
export function makeObjectSeedRepository<const TObject extends ModelObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
    const context = yield* ModelContext
    const Storage = context.storage
    const database = yield* Database
    const repository = yield* makePostgresObjectSeedRepository(
      Storage,
      object,
      database
    )
    return {
      upsert: (input: Parameters<typeof repository.upsert>[0]) =>
        database.transaction(() =>
          Effect.gen(function* () {
            const record = yield* repository.upsert(input)
            yield* updateSearchIndex(
              database,
              [{ id: input.id, objectType: object.id }],
              context
            )
            return record
          })
        ),
    }
  })
}
