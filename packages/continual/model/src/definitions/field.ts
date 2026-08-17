import type { DefinedObject } from "./object"

export interface FieldOptions {
  description?: string
  required?: boolean
}

export interface ScalarFieldDefinition extends FieldOptions {
  kind: "date" | "email" | "phone" | "text" | "url"
}

export interface Choice {
  label?: string
  value: string
}

export interface SelectFieldDefinition extends FieldOptions {
  kind: "select"
  options: ReadonlyArray<Choice>
}

export interface LinkFieldDefinition extends FieldOptions {
  kind: "link"
  objectId: string
}

export type FieldDefinition =
  | LinkFieldDefinition
  | ScalarFieldDefinition
  | SelectFieldDefinition

export type Fields = Readonly<Record<string, FieldDefinition>>

function scalar(
  kind: ScalarFieldDefinition["kind"],
  options: FieldOptions = {}
): ScalarFieldDefinition {
  return { kind, ...options }
}

export function text(options?: FieldOptions) {
  return scalar("text", options)
}

export function email(options?: FieldOptions) {
  return scalar("email", options)
}

export function phone(options?: FieldOptions) {
  return scalar("phone", options)
}

export function url(options?: FieldOptions) {
  return scalar("url", options)
}

export function date(options?: FieldOptions) {
  return scalar("date", options)
}

export function select<const TOptions extends ReadonlyArray<Choice>>(
  options: FieldOptions & { options: TOptions }
): SelectFieldDefinition & { options: TOptions } {
  return { kind: "select", ...options }
}

export function link<const TObject extends DefinedObject>(
  options: FieldOptions & { object: TObject }
): LinkFieldDefinition {
  const { object, ...fieldOptions } = options
  return { kind: "link", objectId: object.id, ...fieldOptions }
}
