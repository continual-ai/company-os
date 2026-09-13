import { Effect, Schema } from "effect"
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
  toEffectObjectWriterCreateSchema,
  toEffectObjectWriterUpdateSchema,
} from "#/runtime/contract/schema.ts"
import type { Expansion } from "#/runtime/model/definition/model-record.ts"
import type {
  ObjectWriterUpdateInput,
  ObjectUpdateValues,
} from "#/runtime/model/definition/object.ts"
import {
  type ObjectCreateInput,
  type ObjectRecord,
  type Etag,
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  RecordId,
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
import { CurrentInvocation } from "#/runtime/server/invocation.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { requireWritableOperation } from "#/runtime/server/operation-mode.ts"
import { makeRecordHydration } from "#/runtime/server/storage/hydration.ts"
import { RecordIdentifiers } from "#/runtime/server/storage/identifiers.ts"
import {
  makeLinkWrites,
  type InitialLinks,
  type LinkUpdates,
} from "#/runtime/server/storage/link-writes.ts"
import { invalidListRequest } from "#/runtime/server/storage/object-query.ts"
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

export function makeRepository<const O extends ObjectType>(object: O) {
  return Effect.gen(function* () {
    const { model } = yield* ModelContext
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
      const records = yield* repository.batchGet(recordIds)
      const found = new Set(records.map(({ id }) => id))
      const missing = recordIds.find((id) => !found.has(id))
      if (missing !== undefined)
        return yield* Effect.fail(
          new ObjectNotFound({ objectType: object.id, recordId: missing })
        )
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

    const create = Effect.fn(`${object.id}.create`)(
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
        const record = yield* repository.insert({
          ...canonical,
          aliases: canonical.aliases ?? [],
          metadata: canonical.metadata ?? {},
          createdBy: actorId,
          id: RecordId(object.id)(generateRecordId(object.id)),
          systemManaged: false,
          updatedBy: actorId,
        })
        yield* graph.initialize(object, record.id, links)
        return yield* repository.get(record.id)
      },
      (effect) => database.transaction(() => effect)
    )

    const update = Effect.fn(`${object.id}.update`)(
      function* (
        input: ObjectWriterUpdateInput<O> & { readonly links?: LinkUpdates }
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
        const current = yield* repository.get(id)
        const canonical = yield* resolveUpdateIdentifiers(
          object,
          values,
          resolveAliases
        )
        yield* assertImmutableFields(object, current, canonical)
        const record = yield* repository.update({
          ...canonical,
          etag: requestedEtag ?? current.etag,
          id,
          updatedBy: actorId,
        })
        yield* plan.apply(record.id)
        return yield* repository.get(record.id)
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
      const current = yield* repository.get(id)
      yield* repository.delete({ etag: etag ?? current.etag, id })
    })

    return {
      batchDelete,
      batchGet,
      create,
      delete: remove,
      get,
      list,
      update,
    }
  })
}

export type Repository<O extends ObjectType> = Effect.Success<
  ReturnType<typeof makeRepository<O>>
>

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
