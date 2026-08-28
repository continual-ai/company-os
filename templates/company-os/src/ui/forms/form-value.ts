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
  | FormValueObject
