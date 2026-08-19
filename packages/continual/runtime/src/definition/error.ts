import { definitionId } from "./identity"
import type { AnySchema, InferSchema } from "./schema"

/** Stable, transport-independent categories derived from canonical API error codes. */
export const errorCategories = [
  "cancelled",
  "unknown",
  "invalidArgument",
  "deadlineExceeded",
  "notFound",
  "alreadyExists",
  "permissionDenied",
  "resourceExhausted",
  "failedPrecondition",
  "aborted",
  "outOfRange",
  "unimplemented",
  "internal",
  "unavailable",
  "dataLoss",
  "unauthenticated",
] as const

export type ErrorCategory = (typeof errorCategories)[number]

export interface DefinedError<
  TCode extends string = string,
  TCategory extends ErrorCategory = ErrorCategory,
  TDetails extends AnySchema = AnySchema,
> {
  category: TCategory
  code: TCode
  description?: string
  details: TDetails
  kind: "error"
  name: string
}

/** The portable value exposed to clients when a declared API error occurs. */
export type ApiError<TError extends DefinedError = DefinedError> =
  TError extends DefinedError
    ? {
        readonly category: TError["category"]
        readonly code: TError["code"]
        readonly details: InferSchema<TError["details"]>
        readonly message: string
      }
    : never

export function defineError<
  const TCode extends string,
  const TCategory extends ErrorCategory,
  const TDetails extends AnySchema,
>(definition: {
  category: TCategory
  code: TCode
  description?: string
  details: TDetails
  name: string
}): DefinedError<TCode, TCategory, TDetails> {
  return {
    kind: "error",
    ...definition,
    code: definitionId(definition.code),
  }
}
