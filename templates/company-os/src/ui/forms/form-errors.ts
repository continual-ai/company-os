/* oxlint-disable anti-slop/no-runtime-typeof -- This boundary normalizes TanStack Form's library-owned ValidationError union. */
import {
  isApiError,
  standardErrorViolations,
  type Violation,
} from "@company/runtime"
import { schemaErrorViolations } from "@company/runtime/effect"
import { Schema } from "effect"

/** Canonical validation failure shape consumed by TanStack Form. */
export interface ApplicationFormError {
  readonly fields: Readonly<Record<string, ReadonlyArray<Violation>>>
  readonly form?: ReadonlyArray<Violation> | undefined
}

export type FormErrorValue =
  | ApplicationFormError
  | ReadonlyArray<FormErrorValue>
  | string
  | { readonly message?: string | undefined }
  | undefined

function fieldNames(path: Violation["path"]): ReadonlyArray<string> {
  if (path === undefined || path.length === 0) return []
  return path.map((_, index) => path.slice(0, index + 1).join("."))
}

export function formErrorFromViolations(
  violations: ReadonlyArray<Violation>
): ApplicationFormError {
  const fields: Record<string, Violation[]> = {}
  const form: Violation[] = []
  for (const violation of violations) {
    const names = fieldNames(violation.path)
    if (names.length === 0) {
      form.push(violation)
      continue
    }
    for (const name of names) {
      const current = fields[name] ?? []
      current.push(violation)
      fields[name] = current
    }
  }
  return form.length === 0 ? { fields } : { fields, form }
}

export class FormValidationError extends Error {
  readonly violations: ReadonlyArray<Violation>

  constructor(violations: ReadonlyArray<Violation>) {
    super(violations[0]?.message ?? "The form is invalid.")
    this.name = "FormValidationError"
    this.violations = violations
  }
}

export interface FormSchemaInput {
  readonly [field: string]: FormSchemaValue
}

type FormSchemaValue =
  | boolean
  | null
  | number
  | string
  | FormSchemaInput
  | ReadonlyArray<FormSchemaValue>

export function decodeFormSchema<T>(
  schema: Schema.Codec<T, unknown>,
  input: FormSchemaInput
): T {
  try {
    return Schema.decodeUnknownSync(schema)(input, { errors: "all" })
  } catch (cause) {
    if (Schema.isSchemaError(cause)) {
      throw new FormValidationError(schemaErrorViolations(cause))
    }
    throw cause
  }
}

export function formErrorFromCause(
  cause: unknown,
  fallback: string
): ApplicationFormError {
  if (cause instanceof FormValidationError) {
    return formErrorFromViolations(cause.violations)
  }
  if (Schema.isSchemaError(cause)) {
    return formErrorFromViolations(schemaErrorViolations(cause))
  }
  if (isApiError(cause)) {
    const violations = standardErrorViolations(cause)
    if (violations !== undefined && violations.length > 0) {
      return formErrorFromViolations(violations)
    }
    return formErrorFromViolations([
      {
        message: cause.message,
        reason: cause.reason,
      },
    ])
  }
  return formErrorFromViolations([
    {
      message: fallback,
      reason: "INVALID",
    },
  ])
}

export function formErrorMessages(
  errors: ReadonlyArray<FormErrorValue>
): ReadonlyArray<{ readonly message: string }> {
  return errors.flatMap((error) => {
    if (Array.isArray(error)) return formErrorMessages(error)
    if (typeof error === "string") return [{ message: error }]
    if (typeof error === "object" && error !== null && "fields" in error) {
      return formErrorMessages(error.form ?? [])
    }
    if (
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      return [{ message: error.message }]
    }
    return []
  })
}

export function focusFirstFormError(form: HTMLFormElement | null): void {
  window.requestAnimationFrame(() => {
    form
      ?.querySelector<HTMLElement>('[aria-invalid="true"]:not([type="hidden"])')
      ?.focus()
  })
}
