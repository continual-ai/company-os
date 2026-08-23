import { Clock, Context, Data, Effect, Option, Schema } from "effect"

import {
  Etag,
  type ActorId,
  type ObjectBatchDeleteInput,
  type ObjectBatchGetInput,
  type ObjectCreateInput,
  type ObjectCreateValues,
  type ObjectDeleteInput,
  type ObjectGetInput,
  type ObjectRecord,
  type ObjectType,
  type ObjectUpdateInput,
  type ObjectUpdateValues,
} from "./definition/object"
import {
  MAX_BATCH_DELETE_SIZE,
  MAX_BATCH_GET_SIZE,
  type Batch,
  type CanonicalListRequest,
  type CanonicalObjectFilter,
  type ObjectFilter,
  type ListRequest,
  type Page,
} from "./definition/request"
import {
  isRecordAlias,
  RecordId,
  Timestamp,
  type AnySchema,
  type RecordAlias,
  type RecordIdentifier,
} from "./definition/schema"
import type { Repository } from "./effect-object-repository"
import {
  toEffectInputSchema,
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

export class InvalidBatchRequest extends Data.TaggedError(
  "InvalidBatchRequest"
)<{
  readonly message: string
  readonly objectType: string
  readonly operation: "batchDelete" | "batchGet"
}> {}

export interface InvocationContext {
  readonly actorId: ActorId
  readonly rootId: RecordId
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
  ) => Effect.Effect<void, InvalidBatchRequest | TError, TRequirements>
  readonly batchGet: (
    input: ObjectBatchGetInput<TObject>
  ) => Effect.Effect<
    Batch<ObjectRecord<TObject>>,
    InvalidBatchRequest | TError,
    TRequirements
  >
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
    input: ObjectUpdateInput<TObject>
  ) => Effect.Effect<
    ObjectRecord<TObject>,
    ImmutablePropertyError | Schema.SchemaError | TError,
    TRequirements
  >
}

export interface MakeOptions<
  TAuthorizationError,
  TAuthorizationRequirements,
  TResolverError,
  TResolverRequirements,
> {
  readonly authorize: (
    request: AuthorizationRequest
  ) => Effect.Effect<
    InvocationContext,
    TAuthorizationError,
    TAuthorizationRequirements
  >
  readonly generateRecordId?: (objectType: string) => string
  readonly generateEtag?: () => string
  readonly resolveRecordAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TResolverError, TResolverRequirements>
}

function defaultRecordId(objectType: string): string {
  return `${objectType}_${globalThis.crypto.randomUUID()}`
}

function defaultEtag(): string {
  return globalThis.crypto.randomUUID()
}

type DecodedValue =
  | boolean
  | null
  | number
  | string
  | undefined
  | ReadonlyArray<DecodedValue>
  | DecodedInput

interface DecodedInput {
  readonly [key: string]: DecodedValue
}

interface DecodedCreateInput extends DecodedInput {
  readonly parentId?: RecordIdentifier
}

function normalizeCreateInput(object: ObjectType, input: DecodedCreateInput) {
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

function resolveIdentifier<TError, TRequirements>(
  expectedType: string,
  identifier: string,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<RecordId, TError, TRequirements> {
  return isRecordAlias(identifier)
    ? resolveAlias(expectedType, identifier).pipe(
        Effect.map(RecordId(expectedType))
      )
    : Effect.succeed(RecordId(expectedType)(identifier))
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

function resolveSchemaIdentifiers<TError, TRequirements>(
  definition: AnySchema,
  value: DecodedValue,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<DecodedValue, TError, TRequirements> {
  if (value === null || value === undefined) return Effect.succeed(value)

  switch (definition.kind) {
    case "array":
      // SAFETY: the input boundary decoded this value with the same array schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return Effect.forEach(value as ReadonlyArray<DecodedValue>, (item) =>
        resolveSchemaIdentifiers(definition.items, item, resolveAlias)
      )
    case "map": {
      // SAFETY: the input boundary decoded this value with the same map schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const entries = Object.entries(value as DecodedInput)
      return Effect.forEach(entries, ([key, item]) =>
        resolveSchemaIdentifiers(definition.values, item, resolveAlias).pipe(
          Effect.map((resolved) => [key, resolved] as const)
        )
      ).pipe(Effect.map(Object.fromEntries))
    }
    case "optional":
      return resolveSchemaIdentifiers(definition.value, value, resolveAlias)
    case "recordId":
      // SAFETY: the input boundary decoded this value as a record identifier.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const identifier = value as string
      return isRecordAlias(identifier)
        ? resolveAlias(definition.typeId, identifier).pipe(
            Effect.map(RecordId(definition.typeId))
          )
        : Effect.succeed(RecordId(definition.typeId)(identifier))
    case "struct": {
      // SAFETY: the input boundary decoded this value with the same struct schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const entries = Object.entries(value as DecodedInput)
      return Effect.forEach(entries, ([key, item]) => {
        const member = definition.properties[key]
        return member === undefined
          ? Effect.succeed([key, item] as const)
          : resolveSchemaIdentifiers(member, item, resolveAlias).pipe(
              Effect.map((resolved) => [key, resolved] as const)
            )
      }).pipe(Effect.map(Object.fromEntries))
    }
    case "union": {
      const member = definition.members.find((candidate) =>
        Option.isSome(
          Schema.decodeUnknownOption(toEffectInputSchema(candidate))(value)
        )
      )
      return member === undefined
        ? Effect.succeed(value)
        : resolveSchemaIdentifiers(member, value, resolveAlias)
    }
    default:
      return Effect.succeed(value)
  }
}

function resolveObjectInputIdentifiers<TError, TRequirements>(
  object: ObjectType,
  input: DecodedInput,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<DecodedInput, TError, TRequirements> {
  return Effect.forEach(Object.entries(input), ([key, value]) => {
    const property = object.properties[key]
    return property === undefined
      ? Effect.succeed([key, value] as const)
      : resolveSchemaIdentifiers(property, value, resolveAlias).pipe(
          Effect.map((resolved) => [key, resolved] as const)
        )
  }).pipe(Effect.map(Object.fromEntries))
}

function resolveCreateIdentifiers<
  TObject extends ObjectType,
  TError,
  TRequirements,
>(
  object: TObject,
  input: DecodedInput,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<ObjectCreateValues<TObject>, TError, TRequirements> {
  return resolveObjectInputIdentifiers(object, input, resolveAlias).pipe(
    Effect.map((resolved) => {
      // SAFETY: schema-directed resolution replaces every input identifier
      // with the canonical value required by the same property schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return resolved as ObjectCreateValues<TObject>
    })
  )
}

function resolveUpdateIdentifiers<
  TObject extends ObjectType,
  TError,
  TRequirements,
>(
  object: TObject,
  input: DecodedInput,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<ObjectUpdateValues<TObject>, TError, TRequirements> {
  return resolveObjectInputIdentifiers(object, input, resolveAlias).pipe(
    Effect.map((resolved) => {
      // SAFETY: schema-directed resolution replaces every input identifier
      // with the canonical value required by the same property schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return resolved as ObjectUpdateValues<TObject>
    })
  )
}

function filterTargetType(object: ObjectType, field: string) {
  if (field === "id") return object.id
  if (field === "parentId") return object.parent.objectType
  const property = object.properties[field]
  return property?.kind === "recordId" ? property.typeId : undefined
}

type FilterNode =
  | { readonly and: ReadonlyArray<FilterNode> }
  | { readonly not: FilterNode }
  | { readonly or: ReadonlyArray<FilterNode> }
  | {
      readonly field: string
      readonly operator: string
      readonly value?: DecodedValue
    }

function resolveFilterNode<TError, TRequirements>(
  object: ObjectType,
  filter: FilterNode,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<FilterNode, TError, TRequirements> {
  if ("and" in filter) {
    return Effect.forEach(filter.and, (member) =>
      resolveFilterNode(object, member, resolveAlias)
    ).pipe(Effect.map((and) => ({ and })))
  }
  if ("or" in filter) {
    return Effect.forEach(filter.or, (member) =>
      resolveFilterNode(object, member, resolveAlias)
    ).pipe(Effect.map((or) => ({ or })))
  }
  if ("not" in filter) {
    return resolveFilterNode(object, filter.not, resolveAlias).pipe(
      Effect.map((not) => ({ not }))
    )
  }

  const expectedType = filterTargetType(object, filter.field)
  if (expectedType === undefined || filter.operator === "isNull") {
    return Effect.succeed(filter)
  }
  if (filter.operator === "in") {
    // SAFETY: reference filters permit `in` only with record identifier arrays.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const identifiers = filter.value as ReadonlyArray<string>
    return Effect.forEach(identifiers, (identifier) =>
      resolveIdentifier(expectedType, identifier, resolveAlias)
    ).pipe(Effect.map((value) => ({ ...filter, value })))
  }
  // SAFETY: reference filters permit only scalar equality outside `in`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const identifier = filter.value as string
  return resolveIdentifier(expectedType, identifier, resolveAlias).pipe(
    Effect.map((value) => ({ ...filter, value }))
  )
}

function resolveFilterIdentifiers<
  TObject extends ObjectType,
  TError,
  TRequirements,
>(
  object: TObject,
  filter: ObjectFilter<TObject>,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<CanonicalObjectFilter<TObject>, TError, TRequirements> {
  // SAFETY: ObjectFilter is the typed public form of this recursive filter node.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const node = filter as FilterNode
  return resolveFilterNode(object, node, resolveAlias).pipe(
    Effect.map((resolved) => {
      // SAFETY: resolution preserves the filter shape and canonicalizes only
      // values for fields whose model schema declares a record reference.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return resolved as CanonicalObjectFilter<TObject>
    })
  )
}

function resolveListRequest<TObject extends ObjectType, TError, TRequirements>(
  object: TObject,
  request: ListRequest<TObject>,
  resolveAlias: (
    expectedType: string,
    alias: RecordAlias
  ) => Effect.Effect<string, TError, TRequirements>
): Effect.Effect<CanonicalListRequest<TObject>, TError, TRequirements> {
  const { filter, ...rest } = request
  return filter === undefined
    ? Effect.succeed(rest)
    : resolveFilterIdentifiers(object, filter, resolveAlias).pipe(
        Effect.map((resolvedFilter) => ({ ...rest, filter: resolvedFilter }))
      )
}

function assertImmutableFields<TObject extends ObjectType>(
  object: TObject,
  current: ObjectRecord<TObject>,
  input: ObjectUpdateValues<TObject>
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
  TAuthorizationRequirements | TRepositoryRequirements | TResolverRequirements
> {
  const decodeCreateUnknown = Schema.decodeUnknownEffect(
    toEffectObjectCreateSchema(object)
  )
  const decodeUpdateUnknown = Schema.decodeUnknownEffect(
    toEffectObjectUpdateSchema(object)
  )
  const generateRecordId = options.generateRecordId ?? defaultRecordId
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
    const recordId = yield* resolveIdentifier(
      object.id,
      id,
      options.resolveRecordAlias
    )
    yield* authorize("get", { recordIds: [recordId] })
    return yield* repository.get(RecordId(object.id)(recordId))
  })

  const list = Effect.fn(`${object.id}.list`)(function* (
    request?: ListRequest<TObject>
  ) {
    yield* authorize("list")
    const resolvedRequest =
      request === undefined
        ? undefined
        : yield* resolveListRequest(object, request, options.resolveRecordAlias)
    return yield* repository.list(resolvedRequest)
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
    const recordIds = yield* Effect.forEach(ids, (id) =>
      resolveIdentifier(object.id, id, options.resolveRecordAlias).pipe(
        Effect.map(RecordId(object.id))
      )
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
    const recordIds = yield* Effect.forEach(ids, (id) =>
      resolveIdentifier(object.id, id, options.resolveRecordAlias).pipe(
        Effect.map(RecordId(object.id))
      )
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
    yield* repository.batchDelete(
      records.map(({ etag, id }) => ({ expectedEtag: etag, id }))
    )
    return undefined
  })

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
      validated.parentId === undefined
        ? undefined
        : yield* resolveIdentifier(
            object.parent.objectType,
            validated.parentId,
            options.resolveRecordAlias
          )
    const context = yield* authorize(
      "create",
      requestedParentId === undefined ? {} : { parentId: requestedParentId }
    )
    const parentId = RecordId(object.parent.objectType)(
      requestedParentId ?? context.rootId
    )
    const canonical = yield* resolveCreateIdentifiers(
      object,
      validated,
      options.resolveRecordAlias
    )
    const now = Timestamp(
      new Date(yield* Clock.currentTimeMillis).toISOString()
    )
    return yield* repository.insert({
      ...canonical,
      aliases: canonical.aliases ?? [],
      annotations: canonical.annotations ?? {},
      createdAt: now,
      createdById: context.actorId,
      etag: Etag(generateEtag()),
      id: RecordId(object.id)(generateRecordId(object.id)),
      parentId,
      updatedAt: now,
      updatedById: context.actorId,
    })
  })

  const update = Effect.fn(`${object.id}.update`)(function* (
    input: ObjectUpdateInput<TObject>
  ) {
    const { id: identifier, ...changes } = input
    const id = yield* resolveIdentifier(
      object.id,
      identifier,
      options.resolveRecordAlias
    ).pipe(Effect.map(RecordId(object.id)))
    const decoded = yield* decodeUpdateUnknown(changes)
    // SAFETY: the compiled update schema accepts only portable decoded values
    // and was derived from this exact object definition.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const validated = decoded as DecodedInput
    const context = yield* authorize("update", { recordIds: [id] })
    const current = yield* repository.get(id)
    const canonical = yield* resolveUpdateIdentifiers(
      object,
      validated,
      options.resolveRecordAlias
    )
    yield* assertImmutableFields(object, current, canonical)
    return yield* repository.update(id, canonical, current.etag, {
      etag: Etag(generateEtag()),
      updatedAt: Timestamp(
        new Date(yield* Clock.currentTimeMillis).toISOString()
      ),
      updatedById: context.actorId,
    })
  })

  const deleteObject = Effect.fn(`${object.id}.delete`)(function* ({
    id: identifier,
  }: ObjectDeleteInput<TObject>) {
    const id = yield* resolveIdentifier(
      object.id,
      identifier,
      options.resolveRecordAlias
    ).pipe(Effect.map(RecordId(object.id)))
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
