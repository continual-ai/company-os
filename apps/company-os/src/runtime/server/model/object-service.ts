import { Data, Effect } from "effect"

import { compileAssetReferences } from "#/runtime/assets/server/references.ts"
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
  type ListRequest,
  type ObjectBatchDeleteInput,
  type ObjectBatchGetInput,
  type ObjectCreateInput,
  type ObjectGetInput,
  type ObjectType,
  type ObjectWriterUpdateInput,
  RecordId,
} from "#/runtime/model/index.ts"
import { Authorization } from "#/runtime/server/authorization/authorization-service.ts"
import { Links } from "#/runtime/server/model/link-service.ts"
import {
  makeObjectWrites,
  ObjectRepositories,
  type ObjectRepository,
  type WriteTarget,
} from "#/runtime/server/model/object-repositories.ts"
import { RecordIdentifierResolver } from "#/runtime/server/model/record-identifier-resolver.ts"
import { Database } from "#/runtime/server/storage/database.ts"

export class InvalidBatchRequest extends Data.TaggedError(
  "InvalidBatchRequest"
)<{
  readonly message: string
  readonly objectType: string
  readonly operation: "batchDelete" | "batchGet"
}> {}

type StandardOperation =
  | "batchDelete"
  | "batchGet"
  | "create"
  | "delete"
  | "get"
  | "list"
  | "update"

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
  readonly authorization: typeof Authorization.Service
  readonly database: typeof Database.Service
  readonly identifiers: typeof RecordIdentifierResolver.Service
  readonly links: typeof Links.Service
  readonly repository: ObjectRepository<O>
}

function makeOperations<const O extends ObjectType>(
  object: O,
  { authorization, database, identifiers, links, repository }: Dependencies<O>
) {
  const resolveAliases = identifiers.resolveAliases
  const authorize = (
    operationId: StandardOperation,
    target: Pick<WriteTarget, "parentId" | "recordIds"> = {}
  ) => authorization.require({ objectType: object.id, operationId, ...target })
  const collectAssets = compileAssetReferences(object)
  const writes = makeObjectWrites(object, repository, resolveAliases, {
    trusted: false,
    guard: (operation, target) =>
      Effect.gen(function* () {
        yield* authorize(operation, {
          ...(target.parentId === undefined
            ? {}
            : { parentId: target.parentId }),
          ...(target.recordIds === undefined
            ? {}
            : { recordIds: target.recordIds }),
        })
        // Referencing a file requires reading it; the reference index later enforces its state.
        const assetIds =
          collectAssets?.(target.values).map(
            (reference) => reference.assetId
          ) ?? []
        if (assetIds.length > 0)
          yield* authorization.require({
            objectType: "asset",
            operationId: "get",
            recordIds: assetIds,
          })
      }),
  })

  const get = Effect.fn(`${object.id}.get`)(function* ({
    id,
  }: ObjectGetInput<O>) {
    const recordId = yield* resolveIdentifier(object.id, id, resolveAliases)
    yield* authorize("get", { recordIds: [recordId] })
    return yield* repository.get(RecordId(object.id)(recordId))
  })

  const list = Effect.fn(`${object.id}.list`)(function* (
    request?: ListRequest<O>
  ) {
    yield* authorize("list")
    const visibleWithin = yield* authorization.visibleWithin({
      objectType: object.id,
      operationId: "get",
    })
    const resolved =
      request === undefined
        ? undefined
        : yield* resolveListRequest(object, request, resolveAliases)
    return yield* repository.list(resolved, { visibleWithin })
  })

  const batchGet = Effect.fn(`${object.id}.batchGet`)(function* ({
    ids,
  }: ObjectBatchGetInput<O>) {
    yield* validateBatchSize(
      object.id,
      "batchGet",
      ids.length,
      MAX_BATCH_GET_SIZE
    )
    const recordIds = yield* resolveIdentifiers(object.id, ids, resolveAliases)
    yield* authorize("batchGet", { recordIds })
    return { items: yield* repository.batchGet(recordIds) }
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
    yield* authorize("batchDelete", { recordIds })
    const records = yield* repository.batchGet(recordIds)
    yield* repository.batchDelete(records.map(({ etag, id }) => ({ etag, id })))
    return undefined
  })

  // Record and declared Links commit together for every caller, not only transports.
  const create = Effect.fn(`${object.id}.create`)(function* (
    input: ModelObjectCreateInput<ModelCatalog, O>
  ) {
    const { links: initialLinks = {}, ...values } = input
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        // SAFETY: the model envelope adds only links to the standard input.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const standard = values as unknown as ObjectCreateInput<O>
        const record = yield* writes.create(standard)
        yield* links.initialize(object, record.id, initialLinks)
        return record
      })
    )
  })

  const update = Effect.fn(`${object.id}.update`)(function* (
    input: ModelObjectUpdateInput<ModelCatalog, O>
  ) {
    const { links: deltas = {}, ...values } = input
    return yield* database.transaction(() =>
      Effect.gen(function* () {
        // SAFETY: the model envelope adds only links to the standard input; the
        // public update schema still decodes these values.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const standard = values as unknown as ObjectWriterUpdateInput<O>
        const record = yield* writes.update(standard)
        yield* links.update(object, record.id, deltas)
        return record
      })
    )
  })

  return {
    batchDelete,
    batchGet,
    create,
    delete: writes.delete,
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
 * resolution, authorization, contract validation, attribution, and atomic Link
 * coordination over `Records`. Every transport and custom override calls this.
 */
export function makeObjectService<const O extends ObjectType>(object: O) {
  return Effect.gen(function* () {
    const operations = makeOperations(object, {
      authorization: yield* Authorization,
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
