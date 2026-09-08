import type { FormValue } from "#/ui/model/form-value.ts"

export interface FormControlAccessibility {
  readonly ariaDescribedBy?: string | undefined
  readonly invalid: boolean
  readonly onBlur: () => void
  readonly onValueChange: (value: FormValue) => void
  readonly value: FormValue
}
