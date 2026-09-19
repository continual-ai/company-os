import { Context, Effect, Layer } from "effect"

import { replaceAssetReferences } from "#/runtime/assets/server/asset-references.ts"
import { compileAssetReferences } from "#/runtime/assets/server/references.ts"
import { RecordId, type ObjectType } from "#/runtime/model/index.ts"
import { resourceProperties } from "#/runtime/model/resource-properties.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { deletionChanges } from "#/runtime/server/storage/deletion-changes.ts"
import {
  makeObjectRepository as makePostgresObjectRepository,
  makeObjectSeedRepository as makePostgresObjectSeedRepository,
  type ObjectDeleteTarget,
  type ObjectInsert,
  type InitialReferences,
  type ObjectRepositoryUpdate,
} from "#/runtime/server/storage/object-repository.ts"
import { updateSearchIndex } from "#/runtime/server/storage/search-index.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

function trackRepository<const O extends ObjectType>(object: O) {
  return Effect.gen(function* () {
    const context = yield* ModelContext
    const database = yield* SqlDatabase
    const pageTokens = yield* PageTokens
    const sql = database.sql
    const core = context.storage.core.objects
    const repository = yield* makePostgresObjectRepository(
      context.storage,
      object,
      database,
      pageTokens
    )
    const events = makeEventWriter(database, context)
    const collectAssets = compileAssetReferences(object)
    const deleting = deletionChanges(database, context)
    const writableFields = new Set([
      ...Object.keys(object.properties),
      ...Object.entries(resourceProperties)
        .filter(([, property]) => !property.outputOnly)
        .map(([key]) => key),
    ])
    const inputFields = (input: object) =>
      Object.entries(input)
        .filter(
          ([key, value]) => value !== undefined && writableFields.has(key)
        )
        .map(([key]) => key)

    const track = <A extends { readonly id: string }, E, R>(
      operation: Effect.Effect<A, E, R>,
      kind: "created" | "updated",
      writtenFields?: ReadonlyArray<string>
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
            ...(writtenFields === undefined ? {} : { writtenFields }),
            snapshot: repository.get(RecordId(object.id)(record.id)).pipe(
              Effect.catchTag("ObjectNotFound", () => Effect.succeed(record)),
              Effect.orDie
            ),
            subjects: yield* events.subjects([record.id]),
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
          const targetsFields = {
            id: core.columns.id,
            objectType: core.columns.objectType,
            etag: core.columns.etag,
          }
          // Lock before reading so the tombstone etag reflects the version actually removed.
          const targets =
            ids.length === 0
              ? []
              : yield* sql<
                  SelectionRow<typeof targetsFields>
                >`select ${projection(targetsFields)}
          from ${core}
          where ${inValues(sql, core.columns.id, [...ids])}
          order by ${sql.csv([core.columns.id])} for update`
          const children = yield* deleting(ids)
          const result = yield* operation
          for (const target of [...targets, ...children])
            yield* events.record({
              type: `${target.objectType}.deleted`,
              version: 1,
              data: {
                id: target.id,
                etag: (BigInt(target.etag) + 1n).toString(),
              },
              subjects: [
                {
                  id: target.id,
                  objectType: target.objectType,
                },
              ],
            })
          return result
        })
      )

    const upsert = (input: ObjectInsert<O>) =>
      database.transaction(() =>
        Effect.gen(function* () {
          // Serialize concurrent upserts of the same identity before deciding its lifecycle event.
          yield* sql`select pg_advisory_xact_lock(hashtextextended(${input.id}, 0))`
          const existingFields = { id: core.columns.id }
          const existing = yield* sql<
            SelectionRow<typeof existingFields>
          >`select ${projection(existingFields)}
          from ${core}
          where ${core.columns.id} = ${input.id}
          limit ${1}`
          return yield* track(
            repository.upsert(input),
            existing.length === 0 ? "created" : "updated",
            inputFields(input)
          )
        })
      )

    return {
      ...repository,
      insert: (input: ObjectInsert<O>, references?: InitialReferences) =>
        track(repository.insert(input, references), "created"),
      update: (input: ObjectRepositoryUpdate<O>) =>
        track(repository.update(input), "updated", inputFields(input)),
      delete: (target: ObjectDeleteTarget<O>) =>
        remove([target.id], repository.delete(target)),
      batchDelete: (targets: ReadonlyArray<ObjectDeleteTarget<O>>) =>
        remove(
          targets.map((target) => target.id),
          repository.batchDelete(targets)
        ),
      upsert,
    }
  })
}

type ObjectRepository<O extends ObjectType> = Effect.Success<
  ReturnType<typeof trackRepository<O>>
>

const make = Effect.gen(function* () {
  const { model, installed } = yield* ModelContext
  const entries = yield* Effect.forEach(
    Object.values(model.objects),
    (object) =>
      trackRepository(object).pipe(
        Effect.map((repository) => [object.id, repository] as const)
      )
  )
  const repositories = new Map(entries)
  const get = <O extends ObjectType>(object: O): ObjectRepository<O> => {
    const repository = repositories.get(object.id)
    if (!installed(object) || repository === undefined)
      throw new Error(`Object '${object.id}' is not installed.`)
    // SAFETY: every repository was constructed from this exact definition.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return repository as unknown as ObjectRepository<O>
  }
  return { get }
})

/** Typed persistence for every installed object; standard writes retain events and integrity checks. */
export class RecordStore extends Context.Service<RecordStore>()(
  "@company/runtime/RecordStore",
  { make }
) {
  static readonly layer = Layer.effect(this, this.make)
}

/** Idempotent seed upsert for system records: converges storage and search without journaling a fact. */
export function makeObjectSeedRepository<const O extends ObjectType>(
  object: O
) {
  return Effect.gen(function* () {
    const context = yield* ModelContext
    const database = yield* SqlDatabase
    const repository = yield* makePostgresObjectSeedRepository(
      context.storage,
      object,
      database
    )
    return {
      upsert: (input: ObjectInsert<O>) =>
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
