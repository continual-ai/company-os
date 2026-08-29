import { defineError, isErrorReason } from "./error"
import { schema, type InferSchema } from "./schema"

const emptyDetails = schema.object({})

const violationPathSegment = schema.union([
  schema.string({ minLength: 1 }),
  schema.number({ integer: true, minimum: 0 }),
])

export const violationSchema = schema.object({
  message: schema.string({ minLength: 1 }),
  path: schema.optional(schema.array(violationPathSegment)),
  reason: schema.string({ minLength: 2, maxLength: 63 }),
})

/** A portable field or operation issue. A missing path applies to the whole operation. */
export type Violation = InferSchema<typeof violationSchema>

function isViolation(value: unknown): value is Violation {
  if (typeof value !== "object" || value === null) return false
  if (!("message" in value) || typeof value.message !== "string") return false
  if (
    !("reason" in value) ||
    typeof value.reason !== "string" ||
    !isErrorReason(value.reason)
  ) {
    return false
  }
  if (!("path" in value) || value.path === undefined) return true
  return (
    Array.isArray(value.path) &&
    value.path.every(
      (segment) =>
        (typeof segment === "string" && segment.length > 0) ||
        (typeof segment === "number" &&
          Number.isInteger(segment) &&
          segment >= 0)
    )
  )
}

/** Reads violations from standard API error details. */
export function standardErrorViolations(
  error: unknown
): ReadonlyArray<Violation> | undefined {
  if (typeof error !== "object" || error === null) return undefined
  if (!("details" in error)) return undefined
  const { details } = error
  if (
    typeof details !== "object" ||
    details === null ||
    !("violations" in details) ||
    !Array.isArray(details.violations) ||
    !details.violations.every(isViolation)
  ) {
    return undefined
  }
  return details.violations
}

export const UnauthenticatedError = defineError({
  name: "Unauthenticated",
  reason: "UNAUTHENTICATED",
  status: "UNAUTHENTICATED",
  description: "The request does not have valid authentication credentials.",
  details: emptyDetails,
})

export const PermissionDeniedError = defineError({
  name: "Permission denied",
  reason: "PERMISSION_DENIED",
  status: "PERMISSION_DENIED",
  description: "The caller is authenticated but cannot perform this operation.",
  details: emptyDetails,
})

export const NotFoundError = defineError({
  name: "Resource not found",
  reason: "NOT_FOUND",
  status: "NOT_FOUND",
  description:
    "The requested resource does not exist or is not visible to the caller.",
  details: schema.object({
    resourceId: schema.string({ minLength: 1 }),
    resourceType: schema.string({ minLength: 1 }),
  }),
})

export const InternalError = defineError({
  name: "Internal error",
  reason: "INTERNAL",
  status: "INTERNAL",
  description: "The server could not complete the request.",
  details: emptyDetails,
})

const violations = schema.object({
  violations: schema.array(violationSchema),
})

export const AlreadyExistsError = defineError({
  name: "Resource already exists",
  reason: "ALREADY_EXISTS",
  status: "ALREADY_EXISTS",
  description:
    "The operation would create a resource or identifier that already exists.",
  details: violations,
})

export const FailedPreconditionError = defineError({
  name: "Failed precondition",
  reason: "FAILED_PRECONDITION",
  status: "FAILED_PRECONDITION",
  description: "The system state must change before the operation can succeed.",
  details: violations,
})

export const AbortedError = defineError({
  name: "Operation aborted",
  reason: "ABORTED",
  status: "ABORTED",
  description:
    "A concurrency conflict requires the caller to restart the operation.",
  details: violations,
})

export const ValidationError = defineError({
  name: "Validation failed",
  reason: "VALIDATION_FAILED",
  status: "INVALID_ARGUMENT",
  description: "The request does not satisfy input or business validation.",
  details: schema.object({
    violations: schema.array(violationSchema),
  }),
})

export const standardErrors = {
  aborted: AbortedError,
  alreadyExists: AlreadyExistsError,
  failedPrecondition: FailedPreconditionError,
  notFound: NotFoundError,
  permissionDenied: PermissionDeniedError,
  unauthenticated: UnauthenticatedError,
  validation: ValidationError,
} as const
