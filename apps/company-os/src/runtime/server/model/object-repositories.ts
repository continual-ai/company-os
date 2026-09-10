import { Context, Data, Effect, Layer, Schema } from "effect"
import { typeid } from "typeid-js"

import type { AssetPrecondition } from "#/runtime/assets/server/asset-error.ts"
import { replaceAssetReferences } from "#/runtime/assets/server/asset-references.ts"
import { compileAssetReferences } from "#/runtime/assets/server/references.ts"
import {
  type DecodedCreateInput,
  type DecodedInput,
  normalizeCreateInput,
  resolveCreateIdentifiers,
  resolveIdentifier,
  resolveUpdateIdentifiers,
} from "#/runtime/contract/object-input.ts"
import {
  toEffectObjectCreateSchema,
  toEffectObjectUpdateSchema,
  toEffectObjectWriterUpdateSchema,
} from "#/runtime/contract/schema.ts"
import type { ObjectUpdateValues } from "#/runtime/model/definition/object.ts"
import {
  RecordId,
  type Etag,
  type ObjectCreateInput,
  type ObjectDeleteInput,
  type ObjectRecord,
  type ObjectType,
  type ObjectWriterUpdateInput,
  type Page,
} from "#/runtime/model/index.ts"
import {
  ROOT_ID,
  SYSTEM_SERVICE_ACCOUNT_ID,
} from "#/runtime/model/system-records.ts"
import { makeEventWriter } from "#/runtime/server/events/event-writer.ts"
import { currentActorId } from "#/runtime/server/invocation-context.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { deletionChanges } from "#/runtime/server/storage/deletion-changes.ts"
import {
  makeObjectRepository as makePostgresObjectRepository,
  makeObjectSeedRepository as makePostgresObjectSeedRepository,
  type ObjectDeleteTarget,
  type ObjectInsert,
  type ObjectRepositoryUpdate,
  type PostgresRepositoryError,
  type RecordAliasNotFound,
  type RepositoryListRequest,
} from "#/runtime/server/storage/object-repository.ts"
import { updateSearchIndex } from "#/runtime/server/storage/search-index.ts"
import {
  inValues,
  projection,
  type SelectionRow,
} from "#/runtime/server/storage/statement.ts"

class ImmutablePropertyError extends Data.TaggedError(
  "ImmutablePropertyError"
)<{
  readonly property: string
  readonly objectType: string
  readonly recordId: string
}> {}

type WriteError = PostgresRepositoryError | AssetPrecondition

/**
 * Typed persistence for one installed object, as returned by `Records.get`.
 * Reads are plain PostgreSQL queries. Writes commit their journal events,
 * search subjects, and asset references with the record and are attributed to
 * the current invocation.
 */
export interface ObjectRepository<O extends ObjectType> {
  readonly get: (
    id: RecordId<O["id"]>
  ) => Effect.Effect<ObjectRecord<O>, PostgresRepositoryError>
  readonly batchGet: (
    ids: ReadonlyArray<RecordId<O["id"]>>
  ) => Effect.Effect<ReadonlyArray<ObjectRecord<O>>, PostgresRepositoryError>
  readonly list: (
    request?: RepositoryListRequest<O>
  ) => Effect.Effect<Page<ObjectRecord<O>>, PostgresRepositoryError>
  readonly insert: (
    record: ObjectInsert<O>
  ) => Effect.Effect<ObjectRecord<O>, WriteError, CurrentInvocation>
  readonly update: (
    command: ObjectRepositoryUpdate<O>
  ) => Effect.Effect<ObjectRecord<O>, WriteError, CurrentInvocation>
  readonly delete: (
    target: ObjectDeleteTarget<O>
  ) => Effect.Effect<void, WriteError, CurrentInvocation>
  /** Deletes every target atomically or leaves every target unchanged. */
  readonly batchDelete: (
    targets: ReadonlyArray<ObjectDeleteTarget<O>>
  ) => Effect.Effect<void, WriteError, CurrentInvocation>
  /** Idempotently converges one complete, stable-ID record for trusted seeds. */
  readonly upsert: (
    record: ObjectInsert<O>
  ) => Effect.Effect<ObjectRecord<O>, WriteError, CurrentInvocation>
}

function trackRepository<const O extends ObjectType>(
  object: O
): Effect.Effect<
  ObjectRepository<O>,
  never,
  ModelContext | Database | PageTokens
> {
  return Effect.gen(function* () {
    const context = yield* ModelContext
    const database = yield* Database
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
    const deleting = deletionChanges(database, object, context)

    const track = <A extends { readonly id: string }, E, R>(
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
            existing.length === 0 ? "created" : "updated"
          )
        })
      )

    return {
      ...repository,
      insert: (input: ObjectInsert<O>) =>
        track(repository.insert(input), "created"),
      update: (input: ObjectRepositoryUpdate<O>) =>
        track(repository.update(input), "updated"),
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

/** Generates the canonical opaque identifier used by standard and custom actions. */
function generateRecordId(objectType: string): string {
  const prefix = objectType
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
  return typeid(prefix).toString()
}

function assertImmutableFields<O extends ObjectType>(
  object: O,
  current: ObjectRecord<O>,
  input: ObjectUpdateValues<O>
): Effect.Effect<void, ImmutablePropertyError> {
  const currentValues = new Map(Object.entries(current))
  const inputValues = new Map(Object.entries(input))
  for (const [propertyId, property] of Object.entries(object.properties)) {
    if (
      property.immutable &&
      inputValues.has(propertyId) &&
      !Object.is(currentValues.get(propertyId), inputValues.get(propertyId))
    ) {
      return Effect.fail(
        new ImmutablePropertyError({
          property: propertyId,
          objectType: object.id,
          recordId: current.id,
        })
      )
    }
  }
  return Effect.void
}

class SystemRecordReadOnly extends Data.TaggedError("SystemRecordReadOnly")<{
  readonly objectType: string
  readonly recordId: string
}> {}

/** System records remain immutable through public writes, including batch deletion. */
export const assertRecordWritable = Effect.fn("@company/assertRecordWritable")(
  function* (
    object: ObjectType,
    record: { readonly id: string; readonly systemManaged: boolean }
  ) {
    if (
      record.systemManaged &&
      (yield* currentActorId) !== SYSTEM_SERVICE_ACCOUNT_ID
    )
      return yield* Effect.fail(
        new SystemRecordReadOnly({ objectType: object.id, recordId: record.id })
      )
    return undefined
  }
)

type ObjectWriteError = WriteError | RecordAliasNotFound

/** Validated writes for one object; public writes enforce field and system-record immutability. */
export interface ObjectWrites<O extends ObjectType> {
  readonly create: (
    input: ObjectCreateInput<O>
  ) => Effect.Effect<ObjectRecord<O>, ObjectWriteError, CurrentInvocation>
  readonly update: (
    input: ObjectWriterUpdateInput<O>
  ) => Effect.Effect<
    ObjectRecord<O>,
    ObjectWriteError | ImmutablePropertyError | SystemRecordReadOnly,
    CurrentInvocation
  >
  readonly delete: (
    input: ObjectDeleteInput<O>
  ) => Effect.Effect<
    void,
    ObjectWriteError | SystemRecordReadOnly,
    CurrentInvocation
  >
}

/**
 * Validated, attributed writes for one object. `trusted` writers accept
 * action-owned output fields and skip immutability checks; governed writes
 * decode the public contract. Callers establish project admission.
 */
export function makeObjectWrites<const O extends ObjectType>(
  object: O,
  repository: ObjectRepository<O>,
  resolveAliases: (typeof RecordIdentifierResolver.Service)["resolveAliases"],
  options: { readonly trusted: boolean }
): ObjectWrites<O> {
  const decodeCreateUnknown = Schema.decodeUnknownEffect(
    toEffectObjectCreateSchema(object)
  )
  const decodeUpdateUnknown = Schema.decodeUnknownEffect(
    options.trusted
      ? toEffectObjectWriterUpdateSchema(object)
      : toEffectObjectUpdateSchema(object)
  )

  const create = Effect.fn(`${object.id}.create`)(function* (
    input: ObjectCreateInput<O>
  ) {
    const decoded = yield* decodeCreateUnknown(input)
    // SAFETY: the compiled create schema accepts only portable decoded values
    // and was derived from this exact object definition.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const decodedInput = decoded as DecodedCreateInput
    const validated = normalizeCreateInput(object, decodedInput)
    const requestedParentId =
      validated.parent === undefined
        ? undefined
        : yield* resolveIdentifier(
            object.parent.typeId,
            validated.parent,
            resolveAliases
          )
    const invocation = yield* CurrentInvocation
    // SAFETY: repository parent validation confirms a concrete interface
    // implementation before commit.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const parent = RecordId(object.parent.typeId)(
      requestedParentId ?? ROOT_ID
    ) as unknown as ObjectRecord<O>["parent"]
    const canonical = yield* resolveCreateIdentifiers(
      object,
      validated,
      resolveAliases
    )
    // SAFETY: the trusted invocation boundary supplies an actor accepted by
    // the closed model before server services execute.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const actorId = invocation.actorId as ObjectRecord<O>["createdBy"]
    return yield* repository.insert({
      ...canonical,
      aliases: canonical.aliases ?? [],
      metadata: canonical.metadata ?? {},
      createdBy: actorId,
      id: RecordId(object.id)(generateRecordId(object.id)),
      parent,
      systemManaged: false,
      updatedBy: actorId,
    })
  })

  const update = Effect.fn(`${object.id}.update`)(function* (
    input: ObjectWriterUpdateInput<O>
  ) {
    const { id: identifier, ...changes } = input
    const id = yield* resolveIdentifier(
      object.id,
      identifier,
      resolveAliases
    ).pipe(Effect.map(RecordId(object.id)))
    const decoded = yield* decodeUpdateUnknown(changes)
    // SAFETY: the compiled update schema accepts only portable decoded values
    // and was derived from this exact object definition.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const validated = decoded as DecodedInput & { readonly etag?: Etag }
    const { etag: requestedEtag, ...values } = validated
    const invocation = yield* CurrentInvocation
    // SAFETY: see the corresponding create boundary above.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const actorId = invocation.actorId as ObjectRecord<O>["updatedBy"]
    const current = yield* repository.get(id)
    if (!options.trusted) yield* assertRecordWritable(object, current)
    const canonical = yield* resolveUpdateIdentifiers(
      object,
      values,
      resolveAliases
    )
    if (!options.trusted)
      yield* assertImmutableFields(object, current, canonical)
    return yield* repository.update({
      ...canonical,
      etag: requestedEtag ?? current.etag,
      id,
      updatedBy: actorId,
    })
  })

  const remove = Effect.fn(`${object.id}.delete`)(function* ({
    etag,
    id: identifier,
  }: ObjectDeleteInput<O>) {
    const id = yield* resolveIdentifier(
      object.id,
      identifier,
      resolveAliases
    ).pipe(Effect.map(RecordId(object.id)))
    const current = yield* repository.get(id)
    if (!options.trusted) yield* assertRecordWritable(object, current)
    yield* repository.delete({ etag: etag ?? current.etag, id })
  })

  return { create, delete: remove, update }
}

const make = Effect.gen(function* () {
  const { model, installed } = yield* ModelContext
  const identifiers = yield* RecordIdentifierResolver
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
  return {
    get,
    /**
     * Server-internal writes for custom Actions and trusted adapters. They validate,
     * attribute, and journal like standard operations;
     * callers establish authority and, for multi-record work, the transaction.
     */
    writer: <O extends ObjectType>(object: O) =>
      makeObjectWrites(object, get(object), identifiers.resolveAliases, {
        trusted: true,
      }),
  }
})

/** Typed persistence for every installed object; standard writes retain events and integrity checks. */
export class ObjectRepositories extends Context.Service<ObjectRepositories>()(
  "@company/runtime/ObjectRepositories",
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
    const database = yield* Database
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
