/* oxlint-disable anti-slop/no-unknown-parameters, eslint/no-underscore-dangle */
// This is the single boundary that normalizes independently typed Effect failures
// into the portable API error contract without leaking infrastructure failures.
import {
  type ConflictError,
  type NotFoundError,
  type PermissionDeniedError,
  type UnauthenticatedError,
  type ValidationError,
  type ApiError,
} from "@company/runtime"
import { Effect, Predicate, Schema } from "effect"

type StandardApiError = ApiError<
  | typeof ConflictError
  | typeof NotFoundError
  | typeof PermissionDeniedError
  | typeof UnauthenticatedError
  | typeof ValidationError
>

interface TaggedFailure {
  readonly _tag: string
}

function isTaggedFailure(error: unknown): error is TaggedFailure {
  return Predicate.hasProperty(error, "_tag") && Predicate.isString(error._tag)
}

function stringProperty(error: unknown, property: string): string | undefined {
  if (!Predicate.hasProperty(error, property)) return undefined
  const value = error[property]
  return Predicate.isString(value) ? value : undefined
}

function firstStringProperty(
  error: unknown,
  property: string
): string | undefined {
  if (!Predicate.hasProperty(error, property)) return undefined
  const values = error[property]
  if (!Array.isArray(values)) return undefined
  const first = values[0]
  return Predicate.isString(first) ? first : undefined
}

function unauthenticated(message: string): StandardApiError {
  return {
    category: "unauthenticated",
    code: "unauthenticated",
    details: {},
    message,
  }
}

function permissionDenied(message: string): StandardApiError {
  return {
    category: "permissionDenied",
    code: "permissionDenied",
    details: {},
    message,
  }
}

function notFound(error: TaggedFailure): StandardApiError {
  const recordId =
    firstStringProperty(error, "recordIds") ??
    stringProperty(error, "recordId") ??
    stringProperty(error, "parentId") ??
    stringProperty(error, "alias") ??
    "unknown"
  const objectType = stringProperty(error, "objectType") ?? "record"
  return {
    category: "notFound",
    code: "notFound",
    details: {
      resourceId: recordId,
      resourceType: objectType,
    },
    message: "The requested resource does not exist or is not visible.",
  }
}

function conflict(error: TaggedFailure): StandardApiError {
  return {
    category: "aborted",
    code: "conflict",
    details: {
      violations: [
        {
          code: error._tag,
          message: "The operation conflicts with current state.",
        },
      ],
    },
    message: "The operation conflicts with current state.",
  }
}

function validation(
  error: TaggedFailure | Schema.SchemaError
): StandardApiError {
  return {
    category: "invalidArgument",
    code: "validation",
    details: {
      fieldViolations: [],
      globalViolations: [
        {
          code: error._tag,
          message:
            error instanceof Error ? error.message : "The request is invalid.",
        },
      ],
    },
    message: "The request is invalid.",
  }
}

const notFoundTags = new Set([
  "AuthorizationTargetNotFound",
  "ObjectNotFound",
  "ObjectParentNotFound",
  "RecordAliasNotFound",
])
const conflictTags = new Set([
  "InvitationInvalid",
  "InvitationRoleScopeMismatch",
  "LastActivePlatformAdministrator",
  "LastPlatformAdministrator",
  "LeadConversionConflict",
  "ObjectWriteConflict",
  "RecordAliasConflict",
  "RoleScopeMismatch",
])
const validationTags = new Set([
  "ImmutablePropertyError",
  "InvalidApiKeyRequest",
  "InvalidBatchRequest",
  "InvalidListRequest",
  "InvalidRolePermission",
  "ObjectParentTypeMismatch",
])

function translateApiError(error: unknown): StandardApiError | undefined {
  if (Schema.isSchemaError(error)) return validation(error)
  if (!isTaggedFailure(error)) return undefined
  if (
    error._tag === "InvalidApiKey" ||
    error._tag === "InvalidSession" ||
    error._tag === "UnsupportedAuthorization"
  ) {
    return unauthenticated("Valid authentication credentials are required.")
  }
  if (
    error._tag === "FirstUserRejected" ||
    error._tag === "InvitationRequired" ||
    error._tag === "UserSuspended" ||
    error._tag === "PermissionDenied"
  ) {
    return permissionDenied("The caller cannot perform this operation.")
  }
  if (notFoundTags.has(error._tag)) return notFound(error)
  if (conflictTags.has(error._tag)) return conflict(error)
  if (validationTags.has(error._tag)) return validation(error)
  return undefined
}

/** Translates deliberate application failures while preserving infrastructure failures. */
export function withApiErrors<A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E | StandardApiError, R> {
  return Effect.catch(effect, (error) => {
    const mapped = translateApiError(error)
    const failure: E | StandardApiError = mapped ?? error
    return Effect.fail(failure)
  })
}
