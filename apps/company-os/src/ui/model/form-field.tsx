import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@company/ui/components/field"

import { errorsForField, type FormErrors } from "./form-errors"

export interface FormControlAccessibility {
  readonly ariaDescribedBy?: string | undefined
  readonly invalid: boolean
}

/** Uniform field presentation over application-owned form error state. */
export function FormField({
  children,
  description,
  errors,
  id,
  label,
  name,
}: {
  readonly children: (
    accessibility: FormControlAccessibility
  ) => React.ReactNode
  readonly description?: string | undefined
  readonly errors: FormErrors
  readonly id: string
  readonly label: string
  readonly name: string
}) {
  const violations = errorsForField(errors, name)
  const invalid = violations.length > 0
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const ariaDescribedBy = [
    ...(description === undefined ? [] : [descriptionId]),
    ...(invalid ? [errorId] : []),
  ].join(" ")

  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children({
        ariaDescribedBy: ariaDescribedBy === "" ? undefined : ariaDescribedBy,
        invalid,
      })}
      {description === undefined ? null : (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      <FieldError id={errorId} errors={violations} />
    </Field>
  )
}
