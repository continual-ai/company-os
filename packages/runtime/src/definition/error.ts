/* oxlint-disable anti-slop/no-runtime-typeof, anti-slop/no-unknown-parameters -- isApiError validates an untrusted transport failure. */
import type { AnySchema, InferSchema } from "./schema"

/** Canonical transport-independent statuses from google.rpc.Code. */
export const errorStatuses = [
  "CANCELLED",
  "UNKNOWN",
  "INVALID_ARGUMENT",
  "DEADLINE_EXCEEDED",
  "NOT_FOUND",
  "ALREADY_EXISTS",
  "PERMISSION_DENIED",
  "RESOURCE_EXHAUSTED",
  "FAILED_PRECONDITION",
  "ABORTED",
  "OUT_OF_RANGE",
  "UNIMPLEMENTED",
  "INTERNAL",
  "UNAVAILABLE",
  "DATA_LOSS",
  "UNAUTHENTICATED",
] as const

export type ErrorStatus = (typeof errorStatuses)[number]

const errorReasonPattern = /^[A-Z][A-Z0-9_]{0,61}[A-Z0-9]$/

/** Tests an untrusted value against the stable API error reason format. */
export function isErrorReason(value: string): boolean {
  return errorReasonPattern.test(value)
}

/** Validates the stable machine-readable reason used by an API error. */
export function errorReason<const TValue extends string>(
  value: TValue
): TValue {
  if (!isErrorReason(value)) {
    throw new Error(
      `Error reason '${value}' must be 2-63 UPPER_SNAKE_CASE characters.`
    )
  }
  return value
}

export interface ErrorType<
  TReason extends string = string,
  TStatus extends ErrorStatus = ErrorStatus,
  TDetails extends AnySchema = AnySchema,
> {
  description?: string
  details: TDetails
  kind: "error"
  name: string
  reason: TReason
  status: TStatus
}

/** The portable value exposed to clients when a declared API error occurs. */
export type ApiError<TError extends ErrorType = ErrorType> =
  TError extends ErrorType
    ? {
        readonly details: InferSchema<TError["details"]>
        readonly message: string
        readonly reason: TError["reason"]
        readonly status: TError["status"]
      }
    : never

/** Narrows an unknown boundary failure to the portable API error envelope. */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === "object" &&
    value !== null &&
    "details" in value &&
    "message" in value &&
    typeof value.message === "string" &&
    "reason" in value &&
    typeof value.reason === "string" &&
    isErrorReason(value.reason) &&
    "status" in value &&
    typeof value.status === "string" &&
    errorStatuses.some((status) => status === value.status)
  )
}

/** Defines a transport-independent error contract that actions may declare. */
export function defineError<
  const TReason extends string,
  const TStatus extends ErrorStatus,
  const TDetails extends AnySchema,
>(definition: {
  description?: string
  details: TDetails
  name: string
  reason: TReason
  status: TStatus
}): ErrorType<TReason, TStatus, TDetails> {
  return {
    kind: "error",
    ...definition,
    reason: errorReason(definition.reason),
  }
}
