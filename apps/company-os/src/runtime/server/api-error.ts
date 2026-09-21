import { Effect, Schema } from "effect"

import { AssetPrecondition } from "#/runtime/assets/server/asset-error.ts"
import type { OperationContract } from "#/runtime/contract/operation-contract.ts"
import { schemaErrorToApiError } from "#/runtime/contract/schema.ts"
import {
  isApiError,
  type ApiError,
  type InternalError,
  type UnauthenticatedError,
  type Violation,
} from "#/runtime/model/index.ts"
import { InvalidIdentityAssertion } from "#/runtime/server/auth/identity-provider.ts"
import { isRuntimeError, type RuntimeError } from "#/runtime/server/errors.ts"
import { constraintApiError } from "#/runtime/server/storage/constraint-error.ts"

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

export function internalApiError(): ApiError<typeof InternalError> {
  return {
    details: {},
    message: "The server could not complete the request.",
    reason: "INTERNAL",
    status: "INTERNAL",
  }
}

function violationError(
  status:
    | "INVALID_ARGUMENT"
    | "FAILED_PRECONDITION"
    | "ALREADY_EXISTS"
    | "ABORTED",
  message: string,
  violations: ReadonlyArray<Violation>
): ApiError {
  return {
    status,
    reason: status === "INVALID_ARGUMENT" ? "VALIDATION_FAILED" : status,
    message,
    details: { violations },
  }
}

/** Exhaustive translation of kernel failures; no reflection or inferred field names. */
function runtimeApiError(error: RuntimeError): ApiError {
  switch (error._tag) {
    case "IdentityProvisioningRequired":
      return unauthenticatedApiError(
        "Valid authentication credentials are required."
      )
    case "ProjectAccessRequired":
    case "UserInterfaceRequired":
    case "SystemRecordReadOnly":
      return {
        details: {},
        message: "The caller cannot perform this operation.",
        reason: "PERMISSION_DENIED",
        status: "PERMISSION_DENIED",
      }
    case "ObjectNotFound":
      return {
        details: { resourceId: error.recordId, resourceType: error.objectType },
        message: "The requested resource does not exist or is not visible.",
        reason: "NOT_FOUND",
        status: "NOT_FOUND",
      }
    case "RecordAliasNotFound":
      return {
        details: { resourceId: error.alias, resourceType: "record" },
        message: "The requested resource does not exist or is not visible.",
        reason: "NOT_FOUND",
        status: "NOT_FOUND",
      }
    case "ObjectWriteConflict":
      return violationError(
        "ABORTED",
        "The operation was aborted by a concurrent change.",
        [
          {
            message: "The record changed. Reload it and try again.",
            path: ["etag"],
            reason: "ETAG_MISMATCH",
          },
        ]
      )
    case "ObjectCheckFailed":
      return violationError(
        "INVALID_ARGUMENT",
        error.message,
        error.fields.map((field) => ({
          message: error.message,
          path: [field],
          reason: "CHECK_FAILED",
        }))
      )
    case "ObjectUniqueConflict":
      return violationError(
        "ALREADY_EXISTS",
        "A record with these values already exists.",
        error.fields.map((field) => ({
          message: "A record with this value already exists.",
          path: [field],
          reason: "NOT_UNIQUE",
        }))
      )
    case "RecordAliasConflict":
      return violationError(
        "ALREADY_EXISTS",
        "The requested identifier already exists.",
        [
          {
            message: `The alias '${error.alias}' is already in use.`,
            path: ["aliases"],
            reason: "RECORD_ALIAS_ALREADY_EXISTS",
          },
        ]
      )
    case "LinkCardinalityConflict":
      return violationError(
        "ALREADY_EXISTS",
        "The link would violate its declared cardinality.",
        [
          {
            message: "This link already has its allowed target.",
            path: ["target"],
            reason: "LINK_CARDINALITY_CONFLICT",
          },
        ]
      )
    case "ObjectDeleteRestricted":
    case "CascadeDeleteRestricted":
      return violationError(
        "FAILED_PRECONDITION",
        "The operation cannot run in the current system state.",
        [
          {
            message:
              "Remove required references to this record before deleting it.",
            reason: "RECORD_STILL_REFERENCED",
          },
        ]
      )
    case "InvalidExpansion":
    case "InvalidLinkRequest":
      return violationError("INVALID_ARGUMENT", "The request is invalid.", [
        {
          message: error.message,
          path: error.path,
          reason:
            error._tag === "InvalidExpansion"
              ? "INVALID_EXPANSION"
              : "INVALID_LINK_REQUEST",
        },
      ])
    case "ImmutablePropertyError":
      return violationError("INVALID_ARGUMENT", "The request is invalid.", [
        {
          message: "This field cannot be changed after creation.",
          path: [error.property],
          reason: "IMMUTABLE_PROPERTY",
        },
      ])
    case "RequiredLinkMissing":
      return violationError("INVALID_ARGUMENT", "The request is invalid.", [
        {
          message: "Select the required related record.",
          path: ["links", error.traversal],
          reason: "REQUIRED_LINK",
        },
      ])
    case "LinkMutationNotAllowed":
      return violationError("INVALID_ARGUMENT", "The request is invalid.", [
        {
          message: "This link is read-only.",
          path: ["links", error.traversal],
          reason: "INVALID_REQUEST",
        },
      ])
    case "InvalidBatchRequest":
    case "InvalidListRequest":
      return violationError("INVALID_ARGUMENT", "The request is invalid.", [
        { message: error.message, reason: "INVALID_REQUEST" },
      ])
  }
  const unreachable: never = error
  throw new Error("Unexpected runtime error", { cause: unreachable })
}

function translateApiError(error: unknown): ApiError | undefined {
  if (isApiError(error)) return error
  if (Schema.isSchemaError(error)) return schemaErrorToApiError(error)
  if (isRuntimeError(error)) return runtimeApiError(error)
  if (error instanceof InvalidIdentityAssertion)
    return unauthenticatedApiError(
      "Valid authentication credentials are required."
    )
  if (error instanceof AssetPrecondition)
    return violationError(
      "FAILED_PRECONDITION",
      "The operation cannot run in the current system state.",
      [
        {
          message: error.message,
          path: (error.field ?? "asset").split("."),
          reason: "ASSET_PRECONDITION",
        },
      ]
    )
  return constraintApiError(error)
}

/** Only declared, recognized failures may cross the public operation boundary. */
export function declaredApiError(
  error: unknown,
  operation?: OperationContract
): ApiError | undefined {
  const mapped = translateApiError(error)
  return mapped &&
    (operation === undefined ||
      operation.errors.some(({ reason }) => reason === mapped.reason))
    ? mapped
    : undefined
}

/** Expected failures retain their public meaning; unexpected failures are logged and sanitized. */
export function withApiErrors<A, E, R>(
  effect: Effect.Effect<A, E, R>,
  operation?: OperationContract
): Effect.Effect<A, ApiError, R> {
  return Effect.catch(effect, (error) => {
    const mapped = declaredApiError(error, operation)
    if (mapped) return Effect.fail(mapped)
    return Effect.logError("Unhandled API failure", error).pipe(
      Effect.andThen(Effect.fail(internalApiError()))
    )
  })
}
