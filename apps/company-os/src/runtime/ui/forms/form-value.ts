export type FormLinkDeltaValue = {
  readonly add?: ReadonlyArray<string> | undefined
  readonly remove?: ReadonlyArray<string> | undefined
}

export interface FormValueObject {
  readonly [property: string]: FormValue | undefined
}

/** Raw controlled values accepted by application form fields before decoding. */
export type FormValue =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<FormValue>
  | FormValueObject

/** The controlled-input contract a form field hands to whichever control renders it. */
export interface FormControlAccessibility {
  readonly ariaDescribedBy?: string | undefined
  readonly invalid: boolean
  readonly onBlur: () => void
  readonly onValueChange: (value: FormValue) => void
  readonly value: FormValue
}
