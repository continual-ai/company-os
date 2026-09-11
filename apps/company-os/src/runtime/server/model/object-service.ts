import { Data, Effect } from "effect"

import {
  resolveIdentifier,
  resolveIdentifiers,
  resolveListRequest,
} from "#/runtime/contract/object-input.ts"
import type {
  ModelObjectCreateInput,
  ModelObjectUpdateInput,
} from "#/runtime/model/definition/model-input.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"
import {
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  RecordId,
  type ListRequest,
  type ObjectBatchDeleteInput,
  type ObjectBatchGetInput,
  type ObjectCreateInput,
  type ObjectDeleteInput,
  type ObjectGetInput,
  type ObjectType,
  type ObjectWriterUpdateInput,
} from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import {
  assertRecordWritable,
  makeObjectWrites,
  ObjectRepositories,
  type ObjectRepository,
} from "#/runtime/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { ObjectNotFound } from "#/runtime/server/storage/object-repository.ts"

export class InvalidBatchRequest extends Data.TaggedError(
  "InvalidBatchRequest"
)<{
  readonly message: string
  readonly objectType: string
  readonly operation: "batchDelete" | "batchGet"
}> {}

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

interface Dependencies<O extends ObjectType> {
  readonly database: typeof Database.Service
  readonly identifiers: typeof RecordIdentifierResolver.Service
  readonly links: typeof Links.Service
  readonly repository: ObjectRepository<O>
}

function makeOperations<const O extends ObjectType>(
  object: O,
  { database, identifiers, links, repository }: Dependencies<O>
) {
  const resolveAliases = identifiers.resolveAliases
  const writes = makeObjectWrites(object, repository, resolveAliases, {
    trusted: false,
  })

  const get = Effect.fn(`${object.id}.get`)(function* ({
    id,
  }: ObjectGetInput<O>) {
    yield* requireProjectAccess
    const recordId = yield* resolveIdentifier(object.id, id, resolveAliases)
    return yield* repository.get(RecordId(object.id)(recordId))
  })

  const list = Effect.fn(`${object.id}.list`)(function* (
    request?: ListRequest<O>
  ) {
    yield* requireProjectAccess
    const resolved =
      request === undefined
        ? undefined
        : yield* resolveListRequest(object, request, resolveAliases)
    return yield* repository.list(resolved)
  })

  const batchGet = Effect.fn(`${object.id}.batchGet`)(function* ({
    ids,
  }: ObjectBatchGetInput<O>) {
    yield* requireProjectAccess
    yield* validateBatchSize(
      object.id,
      "batchGet",
      ids.length,
      MAX_BATCH_GET_SIZE
    )
    const recordIds = yield* resolveIdentifiers(object.id, ids, resolveAliases)
    return { items: yield* repository.batchGet(recordIds) }
  })

  const batchDelete = Effect.fn(`${object.id}.batchDelete`)(function* ({
    ids,
  }: ObjectBatchDeleteInput<O>) {
    yield* requireProjectAccess
    yield* validateBatchSize(
      object.id,
      "batchDelete",
      ids.length,
      MAX_BATCH_DELETE_SIZE
    )
    const recordIds = yield* resolveIdentifiers(object.id, ids, resolveAliases)
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
    for (const record of records) yield* assertRecordWritable(object, record)
    yield* repository.batchDelete(records.map(({ etag, id }) => ({ etag, id })))
    return undefined
  })

  // Record and declared Links commit together for every caller, not only transports.
  const create = Effect.fn(`${object.id}.create`)(function* (
    input: ModelObjectCreateInput<ModelCatalog, O>
  ) {
    yield* requireProjectAccess
    const { links: initialLinks = {}, ...values } = input
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        // SAFETY: the model envelope adds only links to the standard input.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const standard = values as unknown as ObjectCreateInput<O>
        const record = yield* writes.create(standard)
        yield* links.initialize(object, record.id, initialLinks)
        return yield* repository.get(record.id)
      })
    )
  })

  const update = Effect.fn(`${object.id}.update`)(function* (
    input: ModelObjectUpdateInput<ModelCatalog, O>
  ) {
    yield* requireProjectAccess
    const { links: deltas = {}, ...values } = input
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        // SAFETY: the model envelope adds only links to the standard input; the
        // public update schema still decodes these values.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const standard = values as unknown as ObjectWriterUpdateInput<O>
        const record = yield* writes.update(standard)
        yield* links.update(object, record.id, deltas)
        return yield* repository.get(record.id)
      })
    )
  })

  const remove = Effect.fn(`${object.id}.delete`)(function* (
    input: ObjectDeleteInput<O>
  ) {
    yield* requireProjectAccess
    return yield* writes.delete(input)
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
}

type Operations<O extends ObjectType> = ReturnType<typeof makeOperations<O>>

type IfActionEnabled<
  O extends ObjectType,
  TAction extends string,
  TService,
> = TAction extends keyof O["actions"] ? TService : object

/** Standard queries and only the mutations enabled by an object definition. */
export type ObjectService<O extends ObjectType> = Pick<
  Operations<O>,
  "batchGet" | "get" | "list"
> &
  IfActionEnabled<O, "batchDelete", Pick<Operations<O>, "batchDelete">> &
  IfActionEnabled<O, "create", Pick<Operations<O>, "create">> &
  IfActionEnabled<O, "delete", Pick<Operations<O>, "delete">> &
  IfActionEnabled<O, "update", Pick<Operations<O>, "update">>

/**
 * Derives the governed standard operations for one installed object: identifier
 * resolution, project admission, contract validation, attribution, and atomic Link
 * coordination over `Records`. Every transport and custom override calls this.
 */
export function makeObjectService<const O extends ObjectType>(object: O) {
  return Effect.gen(function* () {
    const operations = makeOperations(object, {
      database: yield* Database,
      identifiers: yield* RecordIdentifierResolver,
      links: yield* Links,
      repository: (yield* ObjectRepositories).get(object),
    })
    const service: Record<string, unknown> = {
      batchGet: operations.batchGet,
      get: operations.get,
      list: operations.list,
    }
    for (const action of ["batchDelete", "create", "delete", "update"] as const)
      if (Object.hasOwn(object.actions, action))
        service[action] = operations[action]
    // SAFETY: each mutation is included exactly when the matching standard action
    // exists in this object's normalized action registry.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    return service as ObjectService<O>
  })
}
