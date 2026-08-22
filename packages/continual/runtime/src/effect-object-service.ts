import { Clock, Context, Data, Effect, Schema } from "effect"

import {
  Etag,
  type ActorId,
  type ObjectBatchDeleteInput,
  type ObjectCreateInput,
  type ObjectDeleteInput,
  type ObjectGetInput,
  type ObjectRecord,
  type ObjectType,
  type ObjectUpdateInput,
  type ObjectUpdateRequest,
} from "./definition/object"
import {
  MAX_BATCH_DELETE_SIZE,
  type Batch,
  type ListRequest,
  type Page,
} from "./definition/request"
import type { RootType } from "./definition/root"
import { RecordId, Timestamp } from "./definition/schema"
import type { Repository } from "./effect-object-repository"
import {
  toEffectObjectCreateSchema,
  toEffectObjectUpdateSchema,
} from "./effect-schema"

export class ImmutablePropertyError extends Data.TaggedError(
  "ImmutablePropertyError"
)<{
  readonly property: string
  readonly objectType: string
  readonly recordId: string
}> {}

export class InvalidBatchDeleteRequest extends Data.TaggedError(
  "InvalidBatchDeleteRequest"
)<{
  readonly message: string
  readonly objectType: string
}> {}

export interface InvocationContext {
  readonly actorId: ActorId
  readonly rootId: RecordId<RootType["id"]>
}

/** Request-scoped authenticated actor supplied by a transport boundary. */
export class CurrentActor extends Context.Service<
  CurrentActor,
  InvocationContext
>()("@continual/runtime/CurrentActor") {}

export type ObjectOperation =
  | "batchDelete"
  | "batchGet"
  | "create"
  | "delete"
  | "get"
  | "list"
  | "update"

export interface AuthorizationRequest {
  readonly objectType: string
  readonly operation: ObjectOperation
  readonly parentId?: string
  readonly recordIds?: ReadonlyArray<string>
}

export interface Service<
  TObject extends ObjectType,
  TError = never,
  TRequirements = never,
> {
  readonly batchDelete: (
    input: ObjectBatchDeleteInput<TObject>
  ) => Effect.Effect<void, InvalidBatchDeleteRequest | TError, TRequirements>
  readonly batchGet: (input: {
    readonly ids: ReadonlyArray<RecordId<TObject["id"]>>
  }) => Effect.Effect<Batch<ObjectRecord<TObject>>, TError, TRequirements>
  readonly create: (
    input: ObjectCreateInput<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    TError | Schema.SchemaError,
    TRequirements
  >
  readonly delete: (
    input: ObjectDeleteInput<TObject>
  ) => Effect.Effect<void, TError, TRequirements>
  readonly get: (
    input: ObjectGetInput<TObject>
  ) => Effect.Effect<ObjectRecord<TObject>, TError, TRequirements>
  readonly list: (
    request?: ListRequest<TObject>
  ) => Effect.Effect<Page<ObjectRecord<TObject>>, TError, TRequirements>
  readonly update: (
    input: ObjectUpdateRequest<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    ImmutablePropertyError | Schema.SchemaError | TError,
    TRequirements
  >
}

export interface MakeOptions {
  readonly generateId?: (objectType: string) => string
  readonly generateEtag?: () => string
}

export interface AuthorizedMakeOptions<
  TAuthorizationError,
  TAuthorizationRequirements,
> extends MakeOptions {
  readonly authorize: (
    request: AuthorizationRequest
  ) => Effect.Effect<
    InvocationContext,
    TAuthorizationError,
    TAuthorizationRequirements
  >
}

function defaultId(objectType: string): string {
  return `${objectType}_${globalThis.crypto.randomUUID()}`
}

function defaultEtag(): string {
  return globalThis.crypto.randomUUID()
}

function normalizeCreateInput<TObject extends ObjectType>(
  object: TObject,
  input: ObjectCreateInput<TObject>
): ObjectCreateInput<TObject> {
  const normalized = { ...input }

  for (const [propertyId, property] of Object.entries(object.properties)) {
    if (property.outputOnly || propertyId in normalized) continue

    if (Object.hasOwn(property, "default")) {
      Object.assign(normalized, { [propertyId]: property.default })
    } else if (property.nullable) {
      Object.assign(normalized, { [propertyId]: null })
    }
  }

  return normalized
}

function assertImmutableFields<TObject extends ObjectType>(
  object: TObject,
  current: ObjectRecord<TObject>,
  input: ObjectUpdateInput<TObject>
): Effect.Effect<void, ImmutablePropertyError> {
  for (const [propertyId, property] of Object.entries(object.properties)) {
    const currentValue = Object.entries(current).find(
      ([key]) => key === propertyId
    )?.[1]
    const inputValue = Object.entries(input).find(
      ([key]) => key === propertyId
    )?.[1]
    if (
      property.immutable &&
      propertyId in input &&
      !Object.is(currentValue, inputValue)
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

/**
 * Adds authorization, portable-schema validation, and common record metadata
 * to a repository. Company code supplies the policy capability; there is no
 * permissive default.
 */
export function make<
  const TObject extends ObjectType,
  TRepositoryError,
  TRepositoryRequirements,
  TAuthorizationError,
  TAuthorizationRequirements,
>(
  object: TObject,
  repository: Repository<TObject, TRepositoryError, TRepositoryRequirements>,
  options: AuthorizedMakeOptions<
    TAuthorizationError,
    TAuthorizationRequirements
  >
): Service<
  TObject,
  TAuthorizationError | TRepositoryError,
  TAuthorizationRequirements | TRepositoryRequirements
> {
  const decodeCreate = Schema.decodeUnknownEffect(
    toEffectObjectCreateSchema(object)
  )
  const decodeUpdate = Schema.decodeUnknownEffect(
    toEffectObjectUpdateSchema(object)
  )
  const generateId = options.generateId ?? defaultId
  const generateEtag = options.generateEtag ?? defaultEtag

  const authorize = (
    operation: ObjectOperation,
    target: {
      readonly parentId?: string
      readonly recordIds?: ReadonlyArray<string>
    } = {}
  ) => {
    const request: AuthorizationRequest = {
      objectType: object.id,
      operation,
      ...target,
    }
    return options.authorize(request)
  }

  const get = Effect.fn(`${object.id}.get`)(function* ({
    id,
  }: ObjectGetInput<TObject>) {
    yield* authorize("get", { recordIds: [id] })
    return yield* repository.get(id)
  })

  const list = Effect.fn(`${object.id}.list`)(function* (
    request?: ListRequest<TObject>
  ) {
    yield* authorize("list")
    return yield* repository.list(request)
  })

  const batchGet = Effect.fn(`${object.id}.batchGet`)(function* ({
    ids,
  }: {
    readonly ids: ReadonlyArray<RecordId<TObject["id"]>>
  }) {
    yield* authorize("batchGet", { recordIds: ids })
    return { items: yield* repository.batchGet(ids) }
  })

  const batchDelete = Effect.fn(`${object.id}.batchDelete`)(function* ({
    ids,
  }: ObjectBatchDeleteInput<TObject>) {
    if (ids.length === 0) {
      return yield* Effect.fail(
        new InvalidBatchDeleteRequest({
          message: "At least one ID is required.",
          objectType: object.id,
        })
      )
    }
    if (ids.length > MAX_BATCH_DELETE_SIZE) {
      return yield* Effect.fail(
        new InvalidBatchDeleteRequest({
          message: `At most ${MAX_BATCH_DELETE_SIZE} IDs may be deleted at once.`,
          objectType: object.id,
        })
      )
    }
    if (new Set(ids).size !== ids.length) {
      return yield* Effect.fail(
        new InvalidBatchDeleteRequest({
          message: "IDs must not contain duplicates.",
          objectType: object.id,
        })
      )
    }

    yield* authorize("batchDelete", { recordIds: ids })
    const records = yield* repository.batchGet(ids)
    yield* repository.batchDelete(
      records.map(({ etag, id }) => ({ expectedEtag: etag, id }))
    )
    return undefined
  })

  const create = Effect.fn(`${object.id}.create`)(function* (
    input: ObjectCreateInput<TObject>
  ) {
    const validated = yield* decodeCreate(normalizeCreateInput(object, input))
    const context = yield* authorize(
      "create",
      validated.parentId === undefined ? {} : { parentId: validated.parentId }
    )
    const parentId = RecordId(object.parent.objectType)(
      validated.parentId ?? context.rootId
    )
    const now = Timestamp(
      new Date(yield* Clock.currentTimeMillis).toISOString()
    )
    return yield* repository.insert({
      ...validated,
      aliases: validated.aliases ?? [],
      annotations: validated.annotations ?? {},
      createdAt: now,
      createdById: context.actorId,
      etag: Etag(generateEtag()),
      id: RecordId(object.id)(generateId(object.id)),
      parentId,
      updatedAt: now,
      updatedById: context.actorId,
    })
  })

  const update = Effect.fn(`${object.id}.update`)(function* (
    input: ObjectUpdateRequest<TObject>
  ) {
    const { id, ...changes } = input
    const validated = yield* decodeUpdate(changes)
    const context = yield* authorize("update", { recordIds: [id] })
    const current = yield* repository.get(id)
    yield* assertImmutableFields(object, current, validated)
    return yield* repository.update(id, validated, current.etag, {
      etag: Etag(generateEtag()),
      updatedAt: Timestamp(
        new Date(yield* Clock.currentTimeMillis).toISOString()
      ),
      updatedById: context.actorId,
    })
  })

  const deleteObject = Effect.fn(`${object.id}.delete`)(function* ({
    id,
  }: ObjectDeleteInput<TObject>) {
    yield* authorize("delete", { recordIds: [id] })
    const current = yield* repository.get(id)
    yield* repository.delete(id, current.etag)
  })

  return {
    batchDelete,
    batchGet,
    create,
    delete: deleteObject,
    get,
    list,
    update,
  }
}
