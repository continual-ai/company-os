/* oxlint-disable anti-slop/no-unknown-parameters, eslint/no-underscore-dangle */
// This is the single boundary that normalizes independently typed Effect failures
// into the portable API error contract without leaking infrastructure failures.
import {
  type AbortedError,
  type AlreadyExistsError,
  type ApiError,
  type FailedPreconditionError,
  type InternalError,
  isApiError,
  type NotFoundError,
  type PermissionDeniedError,
  type UnauthenticatedError,
  type ValidationError,
  type Violation,
} from "@company/runtime"
import { schemaErrorToApiError } from "@company/runtime/effect"
import {
  type ExecutableModelOperation,
  modelOperationErrors,
} from "@company/runtime/effect/model-implementation"
import { Effect, Predicate, Schema } from "effect"

type StandardApiError = ApiError<
  | typeof AbortedError
  | typeof AlreadyExistsError
  | typeof FailedPreconditionError
  | typeof InternalError
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

function stringArrayProperty(
  error: unknown,
  property: string
): ReadonlyArray<string> | undefined {
  if (!Predicate.hasProperty(error, property)) return undefined
  const values = error[property]
  return Array.isArray(values) && values.every(Predicate.isString)
    ? values
    : undefined
}

export function unauthenticatedApiError(
  message: string
): ApiError<typeof UnauthenticatedError> {
  return {
    details: {},
    message,
    reason: "UNAUTHENTICATED",
    status: "UNAUTHENTICATED",
  }
}

function permissionDenied(message: string): StandardApiError {
  return {
    details: {},
    message,
    reason: "PERMISSION_DENIED",
    status: "PERMISSION_DENIED",
  }
}

/** Returns the sanitized envelope for a failure with no safe public meaning. */
export function internalApiError(): ApiError<typeof InternalError> {
  return {
    details: {},
    message: "The server could not complete the request.",
    reason: "INTERNAL",
    status: "INTERNAL",
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
    details: {
      resourceId: recordId,
      resourceType: objectType,
    },
    message: "The requested resource does not exist or is not visible.",
    reason: "NOT_FOUND",
    status: "NOT_FOUND",
  }
}

function aborted(_error: TaggedFailure): StandardApiError {
  return {
    details: {
      violations: [
        {
          message: "The record changed. Reload it and try again.",
          path: ["etag"],
          reason: "ETAG_MISMATCH",
        },
      ],
    },
    message: "The operation was aborted by a concurrent change.",
    reason: "ABORTED",
    status: "ABORTED",
  }
}

function alreadyExists(error: TaggedFailure): StandardApiError {
  const alias = stringProperty(error, "alias")
  const fields = stringArrayProperty(error, "fields")
  const violations =
    fields === undefined
      ? [
          {
            message:
              alias === undefined
                ? "The identifier is already in use."
                : `The alias '${alias}' is already in use.`,
            path: ["aliases"],
            reason: "RECORD_ALIAS_ALREADY_EXISTS",
          },
        ]
      : fields.map((field) => ({
          message: "A record with this value already exists.",
          path: [field],
          reason: "NOT_UNIQUE",
        }))
  return {
    details: { violations },
    message:
      fields === undefined
        ? "The requested identifier already exists."
        : "A record with these values already exists.",
    reason: "ALREADY_EXISTS",
    status: "ALREADY_EXISTS",
  }
}

function preconditionViolation(error: TaggedFailure): Violation {
  switch (error._tag) {
    case "RoleScopeMismatch":
      return {
        message: "The role cannot be assigned at this scope.",
        path: ["role"],
        reason: "ROLE_SCOPE_MISMATCH",
      }
    case "LastAdministrator":
      return {
        message: "Another administrator is required.",
        reason: "LAST_ADMINISTRATOR",
      }
    case "LeadConversionConflict":
      return {
        message: "The lead has an incomplete prior conversion.",
        reason: "LEAD_CONVERSION_STATE_INVALID",
      }
    default:
      return {
        message: "The system state must change before trying again.",
        reason: "FAILED_PRECONDITION",
      }
  }
}

function failedPrecondition(error: TaggedFailure): StandardApiError {
  return {
    details: { violations: [preconditionViolation(error)] },
    message: "The operation cannot run in the current system state.",
    reason: "FAILED_PRECONDITION",
    status: "FAILED_PRECONDITION",
  }
}

function validationViolation(error: TaggedFailure): Violation {
  switch (error._tag) {
    case "ImmutablePropertyError":
      return {
        message: "This field cannot be changed after creation.",
        path: [stringProperty(error, "property") ?? "unknown"],
        reason: "IMMUTABLE_PROPERTY",
      }
    case "InvalidRolePermission":
      return {
        message: "The selected role contains an invalid permission.",
        path: ["role"],
        reason: "INVALID_ROLE_PERMISSION",
      }
    case "ObjectParentTypeMismatch":
      return {
        message: "Select a valid parent.",
        path: ["parent"],
        reason: "PARENT_TYPE_MISMATCH",
      }
    default:
      return {
        message: stringProperty(error, "message") ?? "The request is invalid.",
        reason: "INVALID_REQUEST",
      }
  }
}

function validation(error: TaggedFailure): StandardApiError {
  return {
    details: {
      violations: [validationViolation(error)],
    },
    message: "The request is invalid.",
    reason: "VALIDATION_FAILED",
    status: "INVALID_ARGUMENT",
  }
}

const notFoundTags = new Set([
  "AuthorizationTargetNotFound",
  "ObjectNotFound",
  "ObjectParentNotFound",
  "RecordAliasNotFound",
])
const failedPreconditionTags = new Set([
  "LastAdministrator",
  "LeadConversionConflict",
  "RoleScopeMismatch",
])
const validationTags = new Set([
  "ImmutablePropertyError",
  "InvalidBatchRequest",
  "InvalidListRequest",
  "InvalidRolePermission",
  "ObjectParentTypeMismatch",
])

function translateApiError(error: unknown): ApiError | undefined {
  if (isApiError(error)) return error
  if (Schema.isSchemaError(error)) return schemaErrorToApiError(error)
  if (!isTaggedFailure(error)) return undefined
  if (
    error._tag === "IdentityProvisioningRequired" ||
    error._tag === "InvalidIdentityAssertion"
  ) {
    return unauthenticatedApiError(
      "Valid authentication credentials are required."
    )
  }
  if (
    error._tag === "IdentityInactive" ||
    error._tag === "UserInterfaceRequired" ||
    error._tag === "PermissionDenied"
  ) {
    return permissionDenied("The caller cannot perform this operation.")
  }
  if (notFoundTags.has(error._tag)) return notFound(error)
  if (error._tag === "ObjectWriteConflict") return aborted(error)
  if (
    error._tag === "ObjectUniqueConflict" ||
    error._tag === "RecordAliasConflict"
  ) {
    return alreadyExists(error)
  }
  if (failedPreconditionTags.has(error._tag)) {
    return failedPrecondition(error)
  }
  if (validationTags.has(error._tag)) {
    return validation(error)
  }
  return undefined
}

/** Translates application failures and sanitizes unexpected typed failures. */
export function withApiErrors<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operation?: ExecutableModelOperation
): Effect.Effect<A, ApiError, R> {
  return Effect.catch(effect, (error) => {
    const mapped = translateApiError(error)
    if (mapped !== undefined) {
      const declared =
        operation === undefined ||
        modelOperationErrors(operation).some(
          ({ reason }) => reason === mapped.reason
        )
      if (declared) return Effect.fail(mapped)
      return Effect.logError(
        `Operation '${operation.key}' produced undeclared API error '${mapped.reason}'.`
      ).pipe(Effect.andThen(Effect.fail(internalApiError())))
    }
    return Effect.logError("Unhandled API failure", error).pipe(
      Effect.andThen(Effect.fail(internalApiError()))
    )
  })
}
