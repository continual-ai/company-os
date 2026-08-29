import { Effect, Option, Schema } from "effect"

import type {
  ObjectCreateValues,
  ObjectType,
  ObjectUpdateValues,
} from "./definition/object"
import type {
  CanonicalListRequest,
  CanonicalObjectFilter,
  ListRequest,
  ObjectFilter,
} from "./definition/request"
import {
  isRecordAlias,
  RecordId,
  type AnySchema,
  type RecordAlias,
  type RecordIdentifier,
} from "./definition/schema"
import { toEffectInputSchema } from "./effect-schema"

export type RecordAliasResolver<TError, TRequirements> = (
  expectedType: string,
  aliases: ReadonlyArray<RecordAlias>
) => Effect.Effect<ReadonlyArray<string>, TError, TRequirements>

type DecodedValue =
  | boolean
  | null
  | number
  | string
  | undefined
  | ReadonlyArray<DecodedValue>
  | DecodedInput

export interface DecodedInput {
  readonly [key: string]: DecodedValue
}

export interface DecodedCreateInput extends DecodedInput {
  readonly parent?: RecordIdentifier
}

export function normalizeCreateInput(
  object: ObjectType,
  input: DecodedCreateInput
): DecodedCreateInput {
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

export function resolveIdentifier<TError, TRequirements>(
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

export function resolveIdentifiers<TError, TRequirements>(
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

function resolveSchemaIdentifiers<TError, TRequirements>(
  definition: AnySchema,
  value: DecodedValue,
  resolveAliases: RecordAliasResolver<TError, TRequirements>
): Effect.Effect<DecodedValue, TError, TRequirements> {
  if (value === null || value === undefined) return Effect.succeed(value)

  switch (definition.kind) {
    case "array": {
      if (!Array.isArray(value)) {
        return Effect.die("Decoded array input did not contain an array.")
      }
      if (definition.items.kind === "recordId") {
        if (!value.every((item) => typeof item === "string")) {
          return Effect.die(
            "Decoded record-reference array contained a non-string value."
          )
        }
        return resolveIdentifiers(
          definition.items.typeId,
          value,
          resolveAliases
        )
      }
      return Effect.forEach(value, (item) =>
        resolveSchemaIdentifiers(definition.items, item, resolveAliases)
      )
    }
    case "map": {
      if (typeof value !== "object" || Array.isArray(value)) {
        return Effect.die("Decoded map input did not contain an object.")
      }
      return Effect.forEach(Object.entries(value), ([key, item]) =>
        resolveSchemaIdentifiers(definition.values, item, resolveAliases).pipe(
          Effect.map((resolved) => [key, resolved] as const)
        )
      ).pipe(
        Effect.map((resolvedEntries) => Object.fromEntries(resolvedEntries))
      )
    }
    case "optional":
      return resolveSchemaIdentifiers(definition.value, value, resolveAliases)
    case "recordId":
      return typeof value !== "string"
        ? Effect.die("Decoded record reference was not a string.")
        : isRecordAlias(value)
          ? resolveIdentifier(definition.typeId, value, resolveAliases)
          : Effect.succeed(RecordId(definition.typeId)(value))
    case "struct": {
      if (typeof value !== "object" || Array.isArray(value)) {
        return Effect.die("Decoded struct input did not contain an object.")
      }
      return Effect.forEach(Object.entries(value), ([key, item]) => {
        const member = definition.properties[key]
        return member === undefined
          ? Effect.succeed([key, item] as const)
          : resolveSchemaIdentifiers(member, item, resolveAliases).pipe(
              Effect.map((resolved) => [key, resolved] as const)
            )
      }).pipe(
        Effect.map((resolvedEntries) => Object.fromEntries(resolvedEntries))
      )
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
  }).pipe(Effect.map((entries) => Object.fromEntries(entries)))
}

export function resolveCreateIdentifiers<
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

export function resolveUpdateIdentifiers<
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
    if (
      !Array.isArray(filter.value) ||
      !filter.value.every((value) => typeof value === "string")
    ) {
      return Effect.die("Decoded reference filter was not a string array.")
    }
    return resolveIdentifiers(expectedType, filter.value, resolveAliases).pipe(
      Effect.map((value) => ({ ...filter, value }))
    )
  }
  if (typeof filter.value !== "string") {
    return Effect.die("Decoded reference filter was not a string.")
  }
  return resolveIdentifier(expectedType, filter.value, resolveAliases).pipe(
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

export function resolveListRequest<
  TObject extends ObjectType,
  TError,
  TRequirements,
>(
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
