import {
  isApiError,
  standardErrorViolations,
  type Violation,
} from "@company/runtime"
import { schemaErrorViolations } from "@company/runtime/effect"
import { Schema } from "effect"

export interface FormErrors {
  readonly fields: ReadonlyMap<string, ReadonlyArray<Violation>>
  readonly form: ReadonlyArray<Violation>
}

export const emptyFormErrors: FormErrors = {
  fields: new Map(),
  form: [],
}

function fieldName(path: Violation["path"]): string | undefined {
  return path === undefined || path.length === 0 ? undefined : path.join(".")
}

export function formErrorsFromViolations(
  violations: ReadonlyArray<Violation>
): FormErrors {
  const fields = new Map<string, Violation[]>()
  const form: Violation[] = []
  for (const violation of violations) {
    const name = fieldName(violation.path)
    if (name === undefined) {
      form.push(violation)
      continue
    }
    const current = fields.get(name) ?? []
    current.push(violation)
    fields.set(name, current)
  }
  return { fields, form }
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

export function formErrorsFromCause(
  cause: unknown,
  fallback: string
): FormErrors {
  if (cause instanceof FormValidationError) {
    return formErrorsFromViolations(cause.violations)
  }
  if (Schema.isSchemaError(cause)) {
    return formErrorsFromViolations(schemaErrorViolations(cause))
  }
  if (isApiError(cause)) {
    const violations = standardErrorViolations(cause)
    if (violations !== undefined && violations.length > 0) {
      return formErrorsFromViolations(violations)
    }
    return formErrorsFromViolations([
      {
        message: cause.message,
        reason: cause.reason,
      },
    ])
  }
  return formErrorsFromViolations([
    {
      message: fallback,
      reason: "INVALID",
    },
  ])
}

export function errorsForField(
  errors: FormErrors,
  name: string
): ReadonlyArray<Violation> {
  return [...errors.fields].flatMap(([field, violations]) =>
    field === name || field.startsWith(`${name}.`) ? violations : []
  )
}

export function nativeFormViolations(
  form: HTMLFormElement
): ReadonlyArray<Violation> {
  return [...form.elements].flatMap((element) => {
    if (
      !(
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) ||
      element.name === "" ||
      element.validity.valid
    ) {
      return []
    }
    return [
      {
        message: element.validationMessage,
        path: [element.name],
        reason: "INVALID",
      },
    ]
  })
}
