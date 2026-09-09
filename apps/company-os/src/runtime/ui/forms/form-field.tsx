import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "#/runtime/ui/components/field.tsx"
import { useFieldContext } from "#/runtime/ui/forms/form-context.ts"
import {
  formErrorMessages,
  type FormErrorValue,
} from "#/runtime/ui/forms/form-errors.ts"
import type { FormControlAccessibility } from "#/runtime/ui/model/field-editor.ts"
import type { FormValue } from "#/runtime/ui/model/form-value.ts"

/** Uniform field presentation over the current TanStack Form field. */
export function FormField({
  children,
  description,
  id,
  label,
  orientation = "vertical",
}: {
  readonly children: (
    accessibility: FormControlAccessibility
  ) => React.ReactNode
  readonly description?: string | undefined
  readonly id: string
  readonly label: string
  readonly orientation?: "horizontal" | "vertical"
}) {
  const field = useFieldContext<FormValue>()
  // SAFETY: application validators and the API adapter emit FormErrorValue only.
  const errors = formErrorMessages(
    field.state.meta.errors as ReadonlyArray<FormErrorValue>
  )
  const invalid = errors.length > 0
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const ariaDescribedBy = [
    ...(description === undefined ? [] : [descriptionId]),
    ...(invalid ? [errorId] : []),
  ].join(" ")

  return (
    <Field data-invalid={invalid} orientation={orientation}>
      {orientation === "vertical" ? (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      ) : null}
      {children({
        ariaDescribedBy: ariaDescribedBy === "" ? undefined : ariaDescribedBy,
        invalid,
        onBlur: field.handleBlur,
        onValueChange: (value) => {
          field.form.setErrorMap({ onSubmit: undefined })
          field.handleChange(value)
        },
        value: field.state.value,
      })}
      {orientation === "horizontal" ? (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      ) : null}
      {description === undefined ? null : (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      <FieldError id={errorId} errors={errors} />
    </Field>
  )
}
