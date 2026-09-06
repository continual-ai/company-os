import {
  makeObjectRepository as makePostgresObjectRepository,
  makeObjectSeedRepository as makePostgresObjectSeedRepository,
} from "@company/postgres"
import type { Model } from "company-os/model"
import { eq, inArray, sql } from "drizzle-orm"
import { Effect } from "effect"

import { compileAssetReferences } from "@/modules/assets/asset/references"
import { replaceAssetReferences } from "@/modules/assets/asset/server/asset-references"
import { makeEventWriter } from "@/server/events/event-writer"
import { PageTokens } from "@/server/page-tokens"

import { Database } from "./database"
import { deletionChanges } from "./deletion-changes"
import { Storage } from "./schema"
import { updateSearchIndex } from "./search-index"

type ModelObjectType = (typeof Model.objects)[keyof typeof Model.objects]

/** Builds a repository from the model-derived private storage projection. */
export function makeObjectRepository<const TObject extends ModelObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
    const database = yield* Database
    const pageTokens = yield* PageTokens
    const repository = yield* makePostgresObjectRepository(
      Storage,
      object,
      database,
      pageTokens
    )
    const events = makeEventWriter(database)
    const collectAssets = compileAssetReferences(object)
    const deleting = deletionChanges(database, object)
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
              collectAssets(record)
            )
          yield* events.record({
            type: `${object.id}.${kind}`,
            version: 2,
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
          const targets =
            ids.length === 0
              ? []
              : yield* database
                  .select({
                    id: core.id,
                    objectType: core.objectType,
                    ancestorIds: core.ancestorIds,
                    etag: core.etag,
                  })
                  .from(core)
                  .where(inArray(core.id, [...ids]))
                  .orderBy(core.id)
                  .for("update")
          yield* deleting(ids)
          const result = yield* operation
          for (const target of targets)
            yield* events.record({
              type: `${object.id}.deleted`,
              version: 2,
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
            yield* database.execute(
              sql`select pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`
            )
            const existing = yield* database
              .select({ id: Storage.core.objects.id })
              .from(Storage.core.objects)
              .where(eq(Storage.core.objects.id, input.id))
              .limit(1)
            return yield* track(
              repository.upsert(input),
              existing.length === 0 ? "created" : "updated"
            )
          })
        ),
    }
  })
}

/** Builds the narrow idempotent upsert capability used by system seeds. */
export function makeObjectSeedRepository<const TObject extends ModelObjectType>(
  object: TObject
) {
  return Effect.gen(function* () {
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
            yield* updateSearchIndex(database, [
              { id: input.id, objectType: object.id },
            ])
            return record
          })
        ),
    }
  })
}
