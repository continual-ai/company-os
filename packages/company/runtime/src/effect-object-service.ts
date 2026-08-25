import { Context, Data, Effect, Option, Schema } from "effect"
import { typeid } from "typeid-js"

import {
  type Etag,
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
  readonly actorId: RecordId
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

type RecordAliasResolver<TError, TRequirements> = (
  expectedType: string,
  aliases: ReadonlyArray<RecordAlias>
) => Effect.Effect<ReadonlyArray<string>, TError, TRequirements>

export interface MakeOptions<
  TAuthorizationError,
  TAuthorizationRequirements,
  TResolverError,
  TResolverRequirements,
> {
  readonly authorize: (
    request: ObjectAccessRequest
  ) => Effect.Effect<void, TAuthorizationError, TAuthorizationRequirements>
  readonly generateRecordId?: (objectType: string) => string
  readonly rootId: RecordId
  readonly resolveRecordAliases: RecordAliasResolver<
    TResolverError,
    TResolverRequirements
  >
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
  readonly parent?: RecordIdentifier
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<RecordId, TError, TRequirements> {
  return isRecordAlias(identifier)
    ? resolveAliases(expectedType, [identifier]).pipe(
        Effect.flatMap((resolved) => {
          const id = resolved[0]
          return id === undefined
            ? Effect.die("Record alias resolver returned no result.")
            : Effect.succeed(RecordId(expectedType)(id))
        })
      )
    : Effect.succeed(RecordId(expectedType)(identifier))
}

function resolveIdentifiers<TError, TRequirements>(
  expectedType: string,
  identifiers: ReadonlyArray<string>,
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<ReadonlyArray<RecordId>, TError, TRequirements> {
  const aliases = identifiers.filter(isRecordAlias)
  if (aliases.length === 0) {
    return Effect.succeed(
      identifiers.map((identifier) => RecordId(expectedType)(identifier))
    )
  }
  return resolveAliases(expectedType, aliases).pipe(
    Effect.flatMap((resolved) => {
      if (resolved.length !== aliases.length) {
        return Effect.die(
          "Record alias resolver returned an invalid result count."
        )
      }
      let aliasIndex = 0
      return Effect.succeed(
        identifiers.map((identifier) =>
          RecordId(expectedType)(
            isRecordAlias(identifier) ? resolved[aliasIndex++]! : identifier
          )
        )
      )
    })
  )
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<DecodedValue, TError, TRequirements> {
  if (value === null || value === undefined) return Effect.succeed(value)

  switch (definition.kind) {
    case "array":
      if (definition.items.kind === "recordId") {
        // SAFETY: the input boundary decoded this value as record identifiers.
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion
        const identifiers = value as ReadonlyArray<string>
        return resolveIdentifiers(
          definition.items.typeId,
          identifiers,
          resolveAliases
        )
      }
      // SAFETY: the input boundary decoded this value with the same array schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      return Effect.forEach(value as ReadonlyArray<DecodedValue>, (item) =>
        resolveSchemaIdentifiers(definition.items, item, resolveAliases)
      )
    case "map": {
      // SAFETY: the input boundary decoded this value with the same map schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const entries = Object.entries(value as DecodedInput)
      return Effect.forEach(entries, ([key, item]) =>
        resolveSchemaIdentifiers(definition.values, item, resolveAliases).pipe(
          Effect.map((resolved) => [key, resolved] as const)
        )
      ).pipe(Effect.map(Object.fromEntries))
    }
    case "optional":
      return resolveSchemaIdentifiers(definition.value, value, resolveAliases)
    case "recordId":
      // SAFETY: the input boundary decoded this value as a record identifier.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const identifier = value as string
      return isRecordAlias(identifier)
        ? resolveIdentifier(definition.typeId, identifier, resolveAliases)
        : Effect.succeed(RecordId(definition.typeId)(identifier))
    case "struct": {
      // SAFETY: the input boundary decoded this value with the same struct schema.
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion
      const entries = Object.entries(value as DecodedInput)
      return Effect.forEach(entries, ([key, item]) => {
        const member = definition.properties[key]
        return member === undefined
          ? Effect.succeed([key, item] as const)
          : resolveSchemaIdentifiers(member, item, resolveAliases).pipe(
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
        : resolveSchemaIdentifiers(member, value, resolveAliases)
    }
    default:
      return Effect.succeed(value)
  }
}

function resolveObjectInputIdentifiers<TError, TRequirements>(
  object: ObjectType,
  input: DecodedInput,
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<DecodedInput, TError, TRequirements> {
  return Effect.forEach(Object.entries(input), ([key, value]) => {
    const property = object.properties[key]
    return property === undefined
      ? Effect.succeed([key, value] as const)
      : resolveSchemaIdentifiers(property, value, resolveAliases).pipe(
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<ObjectCreateValues<TObject>, TError, TRequirements> {
  return resolveObjectInputIdentifiers(object, input, resolveAliases).pipe(
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<ObjectUpdateValues<TObject>, TError, TRequirements> {
  return resolveObjectInputIdentifiers(object, input, resolveAliases).pipe(
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
  if (field === "parent") return object.parent.typeId
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<FilterNode, TError, TRequirements> {
  if ("and" in filter) {
    return Effect.forEach(filter.and, (member) =>
      resolveFilterNode(object, member, resolveAliases)
    ).pipe(Effect.map((and) => ({ and })))
  }
  if ("or" in filter) {
    return Effect.forEach(filter.or, (member) =>
      resolveFilterNode(object, member, resolveAliases)
    ).pipe(Effect.map((or) => ({ or })))
  }
  if ("not" in filter) {
    return resolveFilterNode(object, filter.not, resolveAliases).pipe(
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
    return resolveIdentifiers(expectedType, identifiers, resolveAliases).pipe(
      Effect.map((value) => ({ ...filter, value }))
    )
  }
  // SAFETY: reference filters permit only scalar equality outside `in`.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const identifier = filter.value as string
  return resolveIdentifier(expectedType, identifier, resolveAliases).pipe(
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<CanonicalObjectFilter<TObject>, TError, TRequirements> {
  // SAFETY: ObjectFilter is the typed public form of this recursive filter node.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const node = filter as FilterNode
  return resolveFilterNode(object, node, resolveAliases).pipe(
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
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<CanonicalListRequest<TObject>, TError, TRequirements> {
  const { filter, ...rest } = request
  return filter === undefined
    ? Effect.succeed(rest)
    : resolveFilterIdentifiers(object, filter, resolveAliases).pipe(
        Effect.map((resolvedFilter) => ({ ...rest, filter: resolvedFilter }))
      )
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

/**
 * Adds authorization, portable-schema validation, and common record fields
 * to a repository. Company code supplies the authorization policy; there is no
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
  const decodeCreateUnknown = Schema.decodeUnknownEffect(
    toEffectObjectCreateSchema(object)
  )
  const decodeUpdateUnknown = Schema.decodeUnknownEffect(
    toEffectObjectUpdateSchema(object)
  )
  const makeRecordId = options.generateRecordId ?? generateRecordId

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
    // SAFETY: authorization and repository parent validation confirm the
    // concrete ID is an implementation of an interface parent before commit.
    // oxlint-disable-next-line anti-slop/no-chained-type-assertions, typescript/no-unsafe-type-assertion
    const parent = RecordId(object.parent.typeId)(
      requestedParentId ?? options.rootId
    ) as unknown as ObjectRecord<TObject>["parent"]
    yield* authorize("create", {
      parentId: parent,
      parentTypeId: object.parent.typeId,
    })
    const canonical = yield* resolveCreateIdentifiers(
      object,
      validated,
      options.resolveRecordAliases
    )
    // SAFETY: the trusted invocation boundary supplies a canonical ID accepted
    // by this model's actor interface before governed services execute.
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
    input: ObjectUpdateInput<TObject>
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
    yield* authorize("update", { recordIds: [id] })
    const current = yield* repository.get(id)
    const canonical = yield* resolveUpdateIdentifiers(
      object,
      values,
      options.resolveRecordAliases
    )
    yield* assertImmutableFields(object, current, canonical)
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
    yield* authorize("delete", { recordIds: [id] })
    const current = yield* repository.get(id)
    yield* repository.delete({ etag: etag ?? current.etag, id })
  })

  type ConstructedService = {
    batchDelete?: typeof batchDelete
    readonly batchGet: typeof batchGet
    create?: typeof create
    delete?: typeof deleteObject
    readonly get: typeof get
    readonly list: typeof list
    update?: typeof update
  }
  const service: ConstructedService = {
    batchGet,
    get,
    list,
  }
  if (Object.hasOwn(object.actions, "batchDelete")) {
    service.batchDelete = batchDelete
  }
  if (Object.hasOwn(object.actions, "create")) service.create = create
  if (Object.hasOwn(object.actions, "delete")) service.delete = deleteObject
  if (Object.hasOwn(object.actions, "update")) service.update = update
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
