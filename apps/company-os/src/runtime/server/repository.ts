import { isDeepStrictEqual } from "node:util"

import { Context, Effect, Layer, Schema } from "effect"
import { typeid } from "typeid-js"

import { expansionInputSchema } from "#/runtime/contract/expansion.ts"
import {
  normalizeCreateInput,
  resolveCreateIdentifiers,
  resolveUpdateIdentifiers,
  type DecodedInput,
  resolveIdentifier,
  resolveIdentifiers,
  resolveListRequest,
} from "#/runtime/contract/object-input.ts"
import { validateQuery } from "#/runtime/contract/query-validation.ts"
import {
  toEffectInputSchema,
  toEffectObjectWriterCreateSchema,
  toEffectObjectWriterUpdateSchema,
} from "#/runtime/contract/schema.ts"
import { preserveSecretInputs } from "#/runtime/contract/secret-update.ts"
import type { Expansion } from "#/runtime/model/definition/model-record.ts"
import type {
  ObjectWriterUpdateInput,
  ObjectUpdateValues,
} from "#/runtime/model/definition/object.ts"
import { containsSecret } from "#/runtime/model/definition/schema.ts"
import {
  type ObjectCreateInput,
  type ObjectRecord,
  type Etag,
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  RecordId,
  RecordAlias,
  type ListRequest,
  type ObjectBatchDeleteInput,
  type ObjectBatchGetInput,
  type ObjectDeleteInput,
  type ObjectGetInput,
  type ObjectType,
} from "#/runtime/model/index.ts"
import {
  ObjectNotFound,
  InvalidBatchRequest,
  ImmutablePropertyError,
} from "#/runtime/server/errors.ts"
import { FinalSnapshots } from "#/runtime/server/events/record-snapshots.ts"
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { completeImmediately } from "#/runtime/server/operation-handler.ts"
import { requireWritableOperation } from "#/runtime/server/operation-mode.ts"
import { assertRecordWritable } from "#/runtime/server/operation-policy.ts"
import { makeRecordHydration } from "#/runtime/server/storage/hydration.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import {
  makeLinkWrites,
  type InitialLinks,
  type LinkUpdates,
} from "#/runtime/server/storage/link-writes.ts"
import { invalidListRequest } from "#/runtime/server/storage/object-query.ts"
import type { StoredRecord } from "#/runtime/server/storage/object-repository.ts"
import { RecordStore } from "#/runtime/server/storage/record-store.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

function validateBatchSize(
  objectType: string,
  operation: "batchDelete" | "batchGet",
  size: number,
  maximum: number
): Effect.Effect<void, InvalidBatchRequest> {
  if (size === 0) {
    return Effect.fail(
      new InvalidBatchRequest({
        message: "At least one identifier is required.",
        objectType,
        operation,
      })
    )
  }
  if (size > maximum) {
    return Effect.fail(
      new InvalidBatchRequest({
        message: `At most ${maximum} identifiers may be supplied at once.`,
        objectType,
        operation,
      })
    )
  }
  return Effect.void
}

function makeRepository<const O extends ObjectType>(object: O) {
  return Effect.gen(function* () {
    const context = yield* ModelContext
    const { model } = context
    const hydration = yield* makeRecordHydration
    const identifiers = yield* RecordIdentifiers
    const repositories = yield* RecordStore
    const repository = repositories.get(object)
    const database = yield* SqlDatabase
    const graph = yield* makeLinkWrites
    const decodeExpansion = Schema.decodeUnknownEffect(
      expansionInputSchema(model, object)
    )
    const resolveAliases = identifiers.resolveAliases

    const get = Effect.fn(`${object.id}.get`)(function* ({
      id,
      expand,
    }: ObjectGetInput<O> & { readonly expand?: Expansion }) {
      if (expand !== undefined) yield* decodeExpansion(expand)
      const recordId = yield* resolveIdentifier(object.id, id, resolveAliases)
      const record = yield* repository.get(RecordId(object.id)(recordId))
      return (yield* hydration.expand([record], expand))[0]!
    })

    const list = Effect.fn(`${object.id}.list`)(function* (
      request?: ListRequest<O>
    ) {
      yield* Effect.try({
        try: () => validateQuery(model, object, request ?? {}),
        catch: (error) =>
          invalidListRequest(
            object,
            error instanceof Error ? error.message : "Invalid query."
          ),
      })
      if (request?.expand !== undefined) yield* decodeExpansion(request.expand)
      const resolved =
        request === undefined
          ? undefined
          : yield* resolveListRequest(object, request, resolveAliases, model)
      const page = yield* repository.list(resolved)
      return {
        ...page,
        items: yield* hydration.expand(page.items, request?.expand),
      }
    })

    const batchGet = Effect.fn(`${object.id}.batchGet`)(function* ({
      ids,
      expand,
    }: ObjectBatchGetInput<O> & { readonly expand?: Expansion }) {
      yield* validateBatchSize(
        object.id,
        "batchGet",
        ids.length,
        MAX_BATCH_GET_SIZE
      )
      const recordIds = yield* resolveIdentifiers(
        object.id,
        ids,
        resolveAliases
      )
      if (expand !== undefined) yield* decodeExpansion(expand)
      return {
        items: yield* hydration.expand(
          yield* repository.batchGet(recordIds),
          expand
        ),
      }
    })

    const batchDelete = Effect.fn(`${object.id}.batchDelete`)(function* ({
      ids,
    }: ObjectBatchDeleteInput<O>) {
      yield* validateBatchSize(
        object.id,
        "batchDelete",
        ids.length,
        MAX_BATCH_DELETE_SIZE
      )
      const recordIds = yield* resolveIdentifiers(
        object.id,
        ids,
        resolveAliases
      )
      if (new Set(recordIds).size !== recordIds.length) {
        return yield* Effect.fail(
          new InvalidBatchRequest({
            message: "Identifiers must resolve to unique records.",
            objectType: object.id,
            operation: "batchDelete",
          })
        )
      }
      const records = yield* repository.getStates(recordIds)
      yield* repository.batchDelete(
        records.map(({ etag, id }) => ({ etag, id }))
      )
      return undefined
    })

    const decodeCreateUnknown = Schema.decodeUnknownEffect(
      toEffectObjectWriterCreateSchema(object)
    )
    const decodeUpdateUnknown = Schema.decodeUnknownEffect(
      toEffectObjectWriterUpdateSchema(object)
    )

    const createRecord = Effect.fn(`${object.id}.write.create`)(
      function* (
        input: ObjectCreateInput<O> &
          Partial<ObjectUpdateValues<O>> & { readonly links?: InitialLinks }
      ) {
        yield* requireWritableOperation
        const { links = {}, ...values } = input
        const decoded = yield* decodeCreateUnknown(values)
        const validated = normalizeCreateInput(object, decoded)
        const invocation = yield* CurrentInvocation
        const canonical = yield* resolveCreateIdentifiers(
          object,
          validated,
          resolveAliases
        )
        // SAFETY: the trusted invocation boundary supplies an actor accepted by
        // the closed model before server services execute.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const actorId = invocation.actorId as ObjectRecord<O>["createdBy"]
        const id = RecordId(object.id)(generateRecordId(object.id))
        const plan = yield* graph.prepareCreate(object, id, links)
        yield* repository.insert(
          {
            ...canonical,
            aliases: canonical.aliases ?? [],
            metadata: canonical.metadata ?? {},
            createdBy: actorId,
            id,
            systemManaged: false,
            updatedBy: actorId,
          },
          plan.references
        )
        yield* plan.apply(id)
        return id
      },
      (effect) => database.transaction(() => effect)
    )

    const updateRecord = Effect.fn(`${object.id}.write.update`)(
      function* (
        input: ObjectWriterUpdateInput<O> & { readonly links?: LinkUpdates },
        skipUnchanged = false
      ) {
        yield* requireWritableOperation
        const { id: identifier, links = {}, ...changes } = input
        const plan = yield* graph.prepareUpdate(object, identifier, links)
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
        const current = yield* repository.getStored(id)
        const secretFields = Object.keys(values).filter(
          (key) =>
            object.properties[key] && containsSecret(object.properties[key])
        )
        const previous = {
          ...current,
          ...(yield* repository.secretValues(id, secretFields)),
        }
        const completed = { ...values }
        for (const key of secretFields) {
          const property = object.properties[key]!
          const value = yield* Schema.decodeUnknownEffect(
            toEffectInputSchema(property)
          )(
            preserveSecretInputs(
              property,
              values[key],
              Reflect.get(previous, key)
            )
          )
          // SAFETY: portable property input has just been validated against its own schema.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          completed[key] = value as DecodedInput[string]
        }
        const canonical = yield* resolveUpdateIdentifiers(
          object,
          completed,
          resolveAliases
        )
        yield* assertImmutableFields(object, previous, canonical)
        if (
          skipUnchanged &&
          Object.entries(canonical).every(
            ([key, value]) =>
              value === undefined ||
              isDeepStrictEqual(Reflect.get(previous, key), value)
          )
        ) {
          yield* plan.apply()
          return id
        }
        yield* repository.update({
          ...canonical,
          etag: requestedEtag ?? current.etag,
          id,
          updatedBy: actorId,
        })
        yield* plan.apply(id)
        return id
      },
      (effect) => database.transaction(() => effect)
    )

    const create = Effect.fn(`${object.id}.create`)(
      function* (
        input: ObjectCreateInput<O> &
          Partial<ObjectUpdateValues<O>> & { readonly links?: InitialLinks }
      ): Effect.fn.Return<
        ObjectRecord<O>,
        | Effect.Error<ReturnType<typeof createRecord>>
        | Effect.Error<ReturnType<typeof repository.get>>,
        CurrentInvocation
      > {
        const id = yield* createRecord(input)
        return yield* repository.get(id)
      },
      (effect) => database.transaction(() => effect)
    )
    const update = Effect.fn(`${object.id}.update`)(
      function* (
        input: ObjectWriterUpdateInput<O> & { readonly links?: LinkUpdates },
        skipUnchanged = false
      ): Effect.fn.Return<
        ObjectRecord<O>,
        | Effect.Error<ReturnType<typeof updateRecord>>
        | Effect.Error<ReturnType<typeof repository.get>>,
        CurrentInvocation
      > {
        const id = yield* updateRecord(input, skipUnchanged)
        return yield* repository.get(id)
      },
      (effect) => database.transaction(() => effect)
    )

    const upsert = Effect.fn(`${object.id}.upsert`)(
      function* (input: {
        readonly alias: RecordAlias
        readonly values: ObjectCreateInput<O> &
          Partial<ObjectUpdateValues<O>> & { readonly aliases?: never }
        readonly links?: InitialLinks
      }) {
        yield* requireWritableOperation
        const alias = RecordAlias(input.alias)
        const values: object = input.values
        // The lock is global to the alias, including callers targeting different object types.
        yield* database.sql`select pg_advisory_xact_lock(hashtextextended(${alias}, 0))`
        const [existing] = yield* database.sql<{
          id: string
        }>`select object_id as id from ${context.storage.core.recordAliases} where alias = ${alias}`
        if (!existing) {
          // The concrete create schema validates this input; TS cannot reduce the generic mapped intersection.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          const initial = {
            ...values,
            aliases: [alias],
            ...(input.links ? { links: input.links } : {}),
          } as unknown as Parameters<typeof create>[0]
          return yield* create(initial)
        }
        // Normal identifier resolution also rejects aliases belonging to another object type.
        // Create values are a valid update subset; the normal update schema validates them again.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const changes = {
          ...values,
          id: alias,
          ...(input.links ? { links: input.links } : {}),
        } as unknown as Parameters<typeof update>[0]
        return yield* update(changes, true)
      },
      (effect) => database.transaction(() => effect)
    )

    const remove = Effect.fn(`${object.id}.delete`)(function* ({
      etag,
      id: identifier,
    }: ObjectDeleteInput<O>) {
      yield* requireWritableOperation
      const id = yield* resolveIdentifier(
        object.id,
        identifier,
        resolveAliases
      ).pipe(Effect.map(RecordId(object.id)))
      const current = yield* repository.getStored(id)
      yield* repository.delete({ etag: etag ?? current.etag, id })
    })

    const checkWritable = Effect.fn(`${object.id}.checkWritable`)(function* (
      ids: ReadonlyArray<ObjectGetInput<O>["id"]>
    ) {
      const resolved = yield* resolveIdentifiers(object.id, ids, resolveAliases)
      for (const record of yield* repository.getStates(resolved))
        yield* assertRecordWritable(object, record)
    })
    const finalRecord = (id: RecordId<O["id"]>) =>
      Effect.gen(function* () {
        const snapshots = yield* FinalSnapshots
        const record = yield* snapshots.get(
          id,
          repository.get(id).pipe(
            Effect.catchTag("ObjectNotFound", () => Effect.succeed(undefined)),
            Effect.orDie
          )
        )
        if (record === undefined)
          return yield* Effect.fail(
            new ObjectNotFound({ objectType: object.id, recordId: id })
          )
        return record
      })
    const operations = {
      get: completeImmediately(get),
      list: completeImmediately(list),
      batchGet: completeImmediately(batchGet),
      create: (input: Parameters<typeof create>[0]) =>
        createRecord(input).pipe(Effect.map(finalRecord)),
      update: (
        input: ObjectWriterUpdateInput<O> & { readonly links?: LinkUpdates }
      ) =>
        checkWritable([input.id]).pipe(
          Effect.andThen(updateRecord(input)),
          Effect.map(finalRecord)
        ),
      delete: completeImmediately((input: ObjectDeleteInput<O>) =>
        checkWritable([input.id]).pipe(Effect.andThen(remove(input)))
      ),
      batchDelete: completeImmediately((input: ObjectBatchDeleteInput<O>) =>
        checkWritable(input.ids).pipe(Effect.andThen(batchDelete(input)))
      ),
    }
    return {
      repository: {
        batchDelete,
        batchGet,
        create,
        delete: remove,
        get,
        list,
        update,
        upsert,
      },
      operations,
      checkWritable,
    }
  })
}

type RepositoryImplementation<O extends ObjectType> = Effect.Success<
  ReturnType<typeof makeRepository<O>>
>
export type Repository<O extends ObjectType> =
  RepositoryImplementation<O>["repository"]

/** Kernel-owned implementations; Database exposes only the module-facing repository. */
export class RecordRepositories extends Context.Service<RecordRepositories>()(
  "@company/RecordRepositories",
  {
    make: Effect.gen(function* () {
      const context = yield* ModelContext
      const entries = yield* Effect.forEach(
        Object.values(context.model.objects),
        (object) =>
          makeRepository(object).pipe(
            Effect.map((implementation) => [object.id, implementation] as const)
          )
      )
      const repositories = new Map(entries)
      return {
        get: <O extends ObjectType>(object: O): RepositoryImplementation<O> => {
          const implementation = repositories.get(object.id)
          if (!context.installed(object) || implementation === undefined)
            throw new Error(`Object '${object.id}' is not installed.`)
          // SAFETY: implementations are built against this exact installed model definition.
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion
          return implementation as unknown as RepositoryImplementation<O>
        },
      }
    }),
  }
) {
  static readonly layer = Layer.effect(this, this.make)
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
  current: StoredRecord<O>,
  input: ObjectUpdateValues<O>
): Effect.Effect<void, ImmutablePropertyError> {
  const currentValues = new Map(Object.entries(current))
  const inputValues = new Map(Object.entries(input))
  for (const [propertyId, property] of Object.entries(object.properties)) {
    if (
      property.immutable &&
      inputValues.has(propertyId) &&
      !isDeepStrictEqual(
        currentValues.get(propertyId),
        inputValues.get(propertyId)
      )
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
