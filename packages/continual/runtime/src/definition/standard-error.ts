import { defineError } from "./error"
import { schema } from "./schema"

const emptyDetails = schema.object({})

const violation = schema.object({
  code: schema.string({ minLength: 1 }),
  message: schema.string({ minLength: 1 }),
})

const fieldViolation = schema.object({
  code: schema.string({ minLength: 1 }),
  field: schema.string({ minLength: 1 }),
  message: schema.string({ minLength: 1 }),
})

export const UnauthenticatedError = defineError({
  code: "unauthenticated",
  category: "unauthenticated",
  name: "Unauthenticated",
  description: "The request does not have valid authentication credentials.",
  details: emptyDetails,
})

export const PermissionDeniedError = defineError({
  code: "permissionDenied",
  category: "permissionDenied",
  name: "Permission denied",
  description: "The caller is authenticated but cannot perform this operation.",
  details: emptyDetails,
})

export const NotFoundError = defineError({
  code: "notFound",
  category: "notFound",
  name: "Resource not found",
  description:
    "The requested resource does not exist or is not visible to the caller.",
  details: schema.object({
    resourceId: schema.string({ minLength: 1 }),
    resourceType: schema.string({ minLength: 1 }),
  }),
})

export const ConflictError = defineError({
  code: "conflict",
  category: "aborted",
  name: "Conflict",
  description:
    "The operation conflicts with the current state of one or more resources.",
  details: schema.object({
    violations: schema.array(violation),
  }),
})

export const ValidationError = defineError({
  code: "validation",
  category: "invalidArgument",
  name: "Validation failed",
  description:
    "The request is structurally valid but does not satisfy field or business validation.",
  details: schema.object({
    fieldViolations: schema.array(fieldViolation),
    globalViolations: schema.array(violation),
  }),
})

export const standardErrors = {
  conflict: ConflictError,
  notFound: NotFoundError,
  permissionDenied: PermissionDeniedError,
  unauthenticated: UnauthenticatedError,
  validation: ValidationError,
} as const
