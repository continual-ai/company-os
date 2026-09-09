export interface FormLinkDeltaValue {
  readonly add?: ReadonlyArray<string> | undefined
  readonly remove?: ReadonlyArray<string> | undefined
}

export interface FormValueObject {
  readonly [property: string]:
    | FormLinkDeltaValue
    | ReadonlyArray<string>
    | string
    | undefined
}

/** Raw controlled values accepted by application form fields before decoding. */
export type FormValue =
  | boolean
  | FormLinkDeltaValue
  | null
  | number
  | string
  | ReadonlyArray<string>
  | ReadonlyArray<FormValueObject>
  | FormValueObject

/** The controlled-input contract a form field hands to whichever control renders it. */
export interface FormControlAccessibility {
  readonly ariaDescribedBy?: string | undefined
  readonly invalid: boolean
  readonly onBlur: () => void
  readonly onValueChange: (value: FormValue) => void
  readonly value: FormValue
}
