export interface FormValueObject {
  readonly [property: string]: string | ReadonlyArray<string>
}

/** Raw controlled values accepted by application form fields before decoding. */
export type FormValue =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<string>
  | FormValueObject
