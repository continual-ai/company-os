import { Context, Data, Effect, Schema } from "effect"
import { typeid } from "typeid-js"

import {
  type Etag,
  type ObjectBatchDeleteInput,
  type ObjectBatchGetInput,
  type ObjectCreateInput,
  type ObjectDeleteInput,
  type ObjectGetInput,
  type ObjectRecord,
  type ObjectType,
  type ObjectUpdateInput,
  type ObjectUpdateValues,
  type ObjectWriterUpdateInput,
} from "./definition/object"
import {
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  type Batch,
  type ListRequest,
  type Page,
} from "./definition/request"
import { RecordId } from "./definition/schema"
import {
  type DecodedCreateInput,
  type DecodedInput,
  normalizeCreateInput,
  type RecordAliasResolver,
  resolveCreateIdentifiers,
  resolveIdentifier,
  resolveIdentifiers,
  resolveListRequest,
  resolveUpdateIdentifiers,
} from "./effect-object-input"
import type { Repository } from "./effect-object-repository"
import {
  toEffectObjectCreateSchema,
  toEffectObjectUpdateSchema,
  toEffectObjectWriterUpdateSchema,
} from "./effect-schema"

export class ImmutablePropertyError extends Data.TaggedError(
  "ImmutablePropertyError"
)<{
  readonly property: string
  readonly objectType: string
  readonly recordId: string
}> {}

export class InvalidBatchRequest extends Data.TaggedError(
  "InvalidBatchRequest"
)<{
  readonly message: string
  readonly objectType: string
  readonly operation: "batchDelete" | "batchGet"
}> {}

export interface InvocationContext {
  /** Actor durably attributed to writes performed by this invocation. */
  readonly actorId: RecordId
  /** Actor whose business authority is evaluated for this invocation. */
  readonly authorizationActorId: RecordId
}

/** Actor selected by a trusted invocation boundary. */
export class CurrentInvocation extends Context.Service<
  CurrentInvocation,
  InvocationContext
>()("@company/runtime/CurrentInvocation") {}

export type ObjectOperation =
  | "batchDelete"
  | "batchGet"
  | "create"
  | "delete"
  | "get"
  | "list"
  | "update"

export interface ObjectAccessRequest {
  readonly objectType: string
  readonly operation: ObjectOperation
  readonly parentId?: string
  readonly parentTypeId?: string
  readonly recordIds?: ReadonlyArray<string>
}

interface QueryService<
  TObject extends ObjectType,
  TError = never,
  TRequirements = never,
> {
  readonly batchGet: (
    input: ObjectBatchGetInput<TObject>
  ) => Effect.Effect<
    Batch<ObjectRecord<TObject>>,
    InvalidBatchRequest | TError,
    TRequirements
  >
  readonly get: (
    input: ObjectGetInput<TObject>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  readonly list: (
    request?: ListRequest<TObject>
  ) => Effect.Effect<Page<ObjectRecord<TObject>>, TError, TRequirements>
}

interface BatchDeleteService<
  TObject extends ObjectType,
  TError,
  TRequirements,
> {
  readonly batchDelete: (
    input: ObjectBatchDeleteInput<TObject>
  ) => Effect.Effect<void, InvalidBatchRequest | TError, TRequirements>
}

interface CreateService<TObject extends ObjectType, TError, TRequirements> {
  readonly create: (
    input: ObjectCreateInput<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    TError | Schema.SchemaError,
    TRequirements
  >
}

interface DeleteService<TObject extends ObjectType, TError, TRequirements> {
  readonly delete: (
    input: ObjectDeleteInput<TObject>
  ) => Effect.Effect<void, TError, TRequirements>
}

interface UpdateService<TObject extends ObjectType, TError, TRequirements> {
  readonly update: (
    input: ObjectUpdateInput<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    ImmutablePropertyError | Schema.SchemaError | TError,
    TRequirements
  >
}

type IfActionEnabled<
  TObject extends ObjectType,
  TAction extends string,
  TService,
> = TAction extends keyof TObject["actions"] ? TService : object

/** Standard queries and only the mutations enabled by an object definition. */
export type Service<
  TObject extends ObjectType,
  TError = never,
  TRequirements = never,
> = QueryService<TObject, TError, TRequirements> &
  IfActionEnabled<
    TObject,
    "batchDelete",
    BatchDeleteService<TObject, TError, TRequirements>
  > &
  IfActionEnabled<
    TObject,
    "create",
    CreateService<TObject, TError, TRequirements>
  > &
  IfActionEnabled<
    TObject,
    "delete",
    DeleteService<TObject, TError, TRequirements>
  > &
  IfActionEnabled<
    TObject,
    "update",
    UpdateService<TObject, TError, TRequirements>
  >

/** Server-internal validated writes without public capability authorization. */
export interface Writer<
  TObject extends ObjectType,
  TError = never,
  TRequirements = never,
> {
  readonly create: (
    input: ObjectCreateInput<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    Schema.SchemaError | TError,
    CurrentInvocation | TRequirements
  >
  readonly delete: (
    input: ObjectDeleteInput<TObject>
  ) => Effect.Effect<void, TError, CurrentInvocation | TRequirements>
  readonly update: (
    input: ObjectWriterUpdateInput<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    ImmutablePropertyError | Schema.SchemaError | TError,
    CurrentInvocation | TRequirements
  >
}

export interface WriterOptions<TResolverError, TResolverRequirements> {
  readonly generateRecordId?: (objectType: string) => string
  readonly rootId: RecordId
  readonly resolveRecordAliases: RecordAliasResolver<
    TResolverError,
    TResolverRequirements
  >
}

export interface MakeOptions<
  TAuthorizationError,
  TAuthorizationRequirements,
  TResolverError,
  TResolverRequirements,
> extends WriterOptions<TResolverError, TResolverRequirements> {
  readonly authorize: (
    request: ObjectAccessRequest
  ) => Effect.Effect<void, TAuthorizationError, TAuthorizationRequirements>
  readonly visibleWithin: (
    request: ObjectAccessRequest
  ) => Effect.Effect<
    ReadonlyArray<string>,
    TAuthorizationError,
    TAuthorizationRequirements
  >
}

/** Generates the canonical opaque identifier used by standard and custom actions. */
export function generateRecordId(objectType: string): string {
  const prefix = objectType
    .replaceAll(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
  return typeid(prefix).toString()
}

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

function assertImmutableFields<TObject extends ObjectType>(
  object: TObject,
  current: ObjectRecord<TObject>,
  input: ObjectUpdateValues<TObject>
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

type WriteTarget = {
  readonly parentId?: string
  readonly parentTypeId?: string
  readonly recordIds?: ReadonlyArray<string>
}

type WriteGuard<TError, TRequirements> = (
  operation: "create" | "delete" | "update",
  target: WriteTarget
) => Effect.Effect<void, TError, TRequirements>

type WriteUpdateInput<
  TObject extends ObjectType,
  TTrusted extends boolean,
> = TTrusted extends true
  ? ObjectWriterUpdateInput<TObject>
  : ObjectUpdateInput<TObject>

function makeWriteMethods<
  const TObject extends ObjectType,
  TTrusted extends boolean,
  TRepositoryError,
  TRepositoryRequirements,
  TResolverError,
  TResolverRequirements,
  TGuardError,
  TGuardRequirements,
>(
  object: TObject,
  repository: Repository<TObject, TRepositoryError, TRepositoryRequirements>,
  options: WriterOptions<TResolverError, TResolverRequirements>,
  trusted: TTrusted,
  guard: WriteGuard<TGuardError, TGuardRequirements>
) {
  const decodeCreateUnknown = Schema.decodeUnknownEffect(
    toEffectObjectCreateSchema(object)
  )
  const decodeUpdateUnknown = Schema.decodeUnknownEffect(
    trusted
      ? toEffectObjectWriterUpdateSchema(object)
      : toEffectObjectUpdateSchema(object)
  )
  const makeRecordId = options.generateRecordId ?? generateRecordId

  const create = Effect.fn(`${object.id}.create`)(function* (
    input: ObjectCreateInput<TObject>
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
            options.resolveRecordAliases
          )
    const context = yield* CurrentInvocation
    // SAFETY: repository parent validation confirms a concrete interface
    // implementation before commit.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const parent = RecordId(object.parent.typeId)(
      requestedParentId ?? options.rootId
    ) as unknown as ObjectRecord<TObject>["parent"]
    yield* guard("create", {
      parentId: parent,
      parentTypeId: object.parent.typeId,
    })
    const canonical = yield* resolveCreateIdentifiers(
      object,
      validated,
      options.resolveRecordAliases
    )
    // SAFETY: the trusted invocation boundary supplies an actor accepted by
    // the closed model before server services execute.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const actorId = context.actorId as ObjectRecord<TObject>["createdBy"]
    return yield* repository.insert({
      ...canonical,
      aliases: canonical.aliases ?? [],
      metadata: canonical.metadata ?? {},
      createdBy: actorId,
      id: RecordId(object.id)(makeRecordId(object.id)),
      parent,
      systemManaged: false,
      updatedBy: actorId,
    })
  })

  const update = Effect.fn(`${object.id}.update`)(function* (
    input: WriteUpdateInput<TObject, TTrusted>
  ) {
    const { id: identifier, ...changes } = input
    const id = yield* resolveIdentifier(
      object.id,
      identifier,
      options.resolveRecordAliases
    ).pipe(Effect.map(RecordId(object.id)))
    const decoded = yield* decodeUpdateUnknown(changes)
    // SAFETY: the compiled update schema accepts only portable decoded values
    // and was derived from this exact object definition.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const validated = decoded as DecodedInput & { readonly etag?: Etag }
    const { etag: requestedEtag, ...values } = validated
    const context = yield* CurrentInvocation
    // SAFETY: see the corresponding create boundary above.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const actorId = context.actorId as ObjectRecord<TObject>["updatedBy"]
    yield* guard("update", { recordIds: [id] })
    const current = yield* repository.get(id)
    const canonical = yield* resolveUpdateIdentifiers(
      object,
      values,
      options.resolveRecordAliases
    )
    if (!trusted) {
      yield* assertImmutableFields(object, current, canonical)
    }
    return yield* repository.update({
      ...canonical,
      etag: requestedEtag ?? current.etag,
      id,
      updatedBy: actorId,
    })
  })

  const deleteObject = Effect.fn(`${object.id}.delete`)(function* ({
    etag,
    id: identifier,
  }: ObjectDeleteInput<TObject>) {
    const id = yield* resolveIdentifier(
      object.id,
      identifier,
      options.resolveRecordAliases
    ).pipe(Effect.map(RecordId(object.id)))
    yield* guard("delete", { recordIds: [id] })
    const current = yield* repository.get(id)
    yield* repository.delete({ etag: etag ?? current.etag, id })
  })

  return { create, delete: deleteObject, update }
}

/**
 * Builds the server-internal write path used by custom business Actions and
 * trusted adapters. It validates and attributes writes but never authorizes a
 * public capability; callers must establish that authority before use.
 */
export function makeWriter<
  const TObject extends ObjectType,
  TRepositoryError,
  TRepositoryRequirements,
  TResolverError,
  TResolverRequirements,
>(
  object: TObject,
  repository: Repository<TObject, TRepositoryError, TRepositoryRequirements>,
  options: WriterOptions<TResolverError, TResolverRequirements>
): Writer<
  TObject,
  TRepositoryError | TResolverError,
  TRepositoryRequirements | TResolverRequirements
> {
  return makeWriteMethods<
    TObject,
    true,
    TRepositoryError,
    TRepositoryRequirements,
    TResolverError,
    TResolverRequirements,
    never,
    never
  >(object, repository, options, true, () => Effect.void)
}

/**
 * Adds authorization, portable-schema validation, and common record fields
 * to a repository. Application code supplies the authorization policy; there is no
 * permissive default.
 */
export function make<
  const TObject extends ObjectType,
  TRepositoryError,
  TRepositoryRequirements,
  TAuthorizationError,
  TAuthorizationRequirements,
  TResolverError,
  TResolverRequirements,
>(
  object: TObject,
  repository: Repository<TObject, TRepositoryError, TRepositoryRequirements>,
  options: MakeOptions<
    TAuthorizationError,
    TAuthorizationRequirements,
    TResolverError,
    TResolverRequirements
  >
): Service<
  TObject,
  TAuthorizationError | TRepositoryError | TResolverError,
  | CurrentInvocation
  | TAuthorizationRequirements
  | TRepositoryRequirements
  | TResolverRequirements
> {
  const authorize = (
    operation: ObjectOperation,
    target: {
      readonly parentId?: string
      readonly parentTypeId?: string
      readonly recordIds?: ReadonlyArray<string>
    } = {}
  ) => {
    const request: ObjectAccessRequest = {
      objectType: object.id,
      operation,
      ...target,
    }
    return options.authorize(request)
  }
  const writes = makeWriteMethods(
    object,
    repository,
    options,
    false,
    (operation, target) => authorize(operation, target)
  )

  const get = Effect.fn(`${object.id}.get`)(function* ({
    id,
  }: ObjectGetInput<TObject>) {
    const recordId = yield* resolveIdentifier(
      object.id,
      id,
      options.resolveRecordAliases
    )
    yield* authorize("get", { recordIds: [recordId] })
    return yield* repository.get(RecordId(object.id)(recordId))
  })

  const list = Effect.fn(`${object.id}.list`)(function* (
    request?: ListRequest<TObject>
  ) {
    const authorizationRequest: ObjectAccessRequest = {
      objectType: object.id,
      operation: "list",
    }
    const visibleWithin = yield* options.visibleWithin(authorizationRequest)
    const resolvedRequest =
      request === undefined
        ? undefined
        : yield* resolveListRequest(
            object,
            request,
            options.resolveRecordAliases
          )
    return yield* repository.list(resolvedRequest, { visibleWithin })
  })

  const batchGet = Effect.fn(`${object.id}.batchGet`)(function* ({
    ids,
  }: ObjectBatchGetInput<TObject>) {
    yield* validateBatchSize(
      object.id,
      "batchGet",
      ids.length,
      MAX_BATCH_GET_SIZE
    )
    const recordIds = yield* resolveIdentifiers(
      object.id,
      ids,
      options.resolveRecordAliases
    )
    yield* authorize("batchGet", { recordIds })
    return { items: yield* repository.batchGet(recordIds) }
  })

  const batchDelete = Effect.fn(`${object.id}.batchDelete`)(function* ({
    ids,
  }: ObjectBatchDeleteInput<TObject>) {
    yield* validateBatchSize(
      object.id,
      "batchDelete",
      ids.length,
      MAX_BATCH_DELETE_SIZE
    )
    const recordIds = yield* resolveIdentifiers(
      object.id,
      ids,
      options.resolveRecordAliases
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

    yield* authorize("batchDelete", { recordIds })
    const records = yield* repository.batchGet(recordIds)
    yield* repository.batchDelete(records.map(({ etag, id }) => ({ etag, id })))
    return undefined
  })

  type ConstructedService = {
    batchDelete?: typeof batchDelete
    readonly batchGet: typeof batchGet
    create?: typeof writes.create
    delete?: typeof writes.delete
    readonly get: typeof get
    readonly list: typeof list
    update?: typeof writes.update
  }
  const service: ConstructedService = {
    batchGet,
    get,
    list,
  }
  if (Object.hasOwn(object.actions, "batchDelete")) {
    service.batchDelete = batchDelete
  }
  if (Object.hasOwn(object.actions, "create")) service.create = writes.create
  if (Object.hasOwn(object.actions, "delete")) service.delete = writes.delete
  if (Object.hasOwn(object.actions, "update")) service.update = writes.update
  // SAFETY: every conditional method is included exactly when the matching
  // standard action exists in this object's normalized action registry.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return service as Service<
    TObject,
    TAuthorizationError | TRepositoryError | TResolverError,
    | CurrentInvocation
    | TAuthorizationRequirements
    | TRepositoryRequirements
    | TResolverRequirements
  >
}
