import { isApiError } from "#/runtime/model/definition/error.ts"

/** A failed refresh can retain data in Query; these responses make that data unusable. */
export function isUnavailable(error: unknown): boolean {
  return (
    isApiError(error) &&
    (error.status === "NOT_FOUND" ||
      error.status === "UNAUTHENTICATED" ||
      error.status === "PERMISSION_DENIED")
  )
}

export function queryErrorMessage(error: unknown): string | undefined {
  if (error === null || error === undefined) return undefined
  return isApiError(error) || error instanceof Error
    ? error.message
    : "The request failed. Please try again."
}
