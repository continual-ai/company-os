import { Schema } from "effect"

import { toEffectOperationInput } from "#/runtime/contract/schema.ts"
import type { Action, AnySchema } from "#/runtime/model/index.ts"
import { FormValidationError } from "#/runtime/ui/forms/form-errors.ts"
import type { FormValue } from "#/runtime/ui/forms/form-value.ts"
import {
  isSupportedFormSchema,
  type ObjectFormValues,
} from "#/runtime/ui/model/object-form.ts"

export function operationFormFields(action: Action, recordId?: string) {
  return Object.entries(action.input.properties)
    .filter(
      ([id]) =>
        !(action.scope === "object" && recordId !== undefined && id === "id")
    )
    .map(([id, definition]) => ({
      id,
      schema: definition.kind === "optional" ? definition.value : definition,
      required:
        definition.kind !== "optional" &&
        !definition.nullable &&
        definition.default === undefined,
    }))
}
function defaultValue(schema: AnySchema): FormValue {
  const value = schema.default
  if (schema.kind === "boolean") return value === true
  if (
    schema.kind === "money" ||
    schema.kind === "file" ||
    schema.kind === "image" ||
    schema.kind === "media"
  ) {
    return typeof value === "object" && value !== null
      ? Object.fromEntries(
          Object.entries(value).map(([key, item]) => [
            key,
            typeof item === "string" ? item : "",
          ])
        )
      : {}
  }
  if (schema.kind === "array" && isSupportedFormSchema(schema)) {
    if (["file", "image", "media"].includes(schema.items.kind)) return []
    return Array.isArray(value) ? value.join("\n") : ""
  }
  if (!isSupportedFormSchema(schema))
    return value === undefined ? "" : JSON.stringify(value)
  return typeof value === "string"
    ? value
    : typeof value === "number"
      ? String(value)
      : ""
}
export function operationFormDefaults(
  action: Action,
  recordId?: string
): ObjectFormValues {
  return Object.fromEntries(
    operationFormFields(action, recordId)
      .filter(({ id }) => {
        const definition = action.input.properties[id]!
        return (
          definition.kind !== "optional" ||
          definition.value.default !== undefined
        )
      })
      .map(({ id, schema }) => [id, defaultValue(schema)])
  )
}
function inputValue(schema: AnySchema, raw: FormValue | undefined): unknown {
  if (schema.kind === "optional")
    return raw === "" || raw === undefined
      ? undefined
      : inputValue(schema.value, raw)
  if (raw === "" || raw === undefined) {
    if (schema.default !== undefined) return schema.default
    if (schema.nullable) return null
  }
  if (!isSupportedFormSchema(schema))
    return typeof raw === "string" ? JSON.parse(raw) : raw
  if (schema.kind === "number") return raw === "" ? raw : Number(raw)
  if (schema.kind === "array" && typeof raw === "string")
    return raw
      .split(/[\n,]/)
      .map((value) => value.trim())
      .filter(Boolean)
  if (
    schema.kind === "string" &&
    schema.format === "timestamp" &&
    typeof raw === "string" &&
    raw !== ""
  )
    return new Date(raw).toISOString()
  return raw
}
export function decodeOperationForm(
  action: Action,
  values: ObjectFormValues,
  recordId?: string
) {
  const input = Object.fromEntries(
    Object.entries(action.input.properties).flatMap(([id, schema]) => {
      if (action.scope === "object" && id === "id" && recordId !== undefined)
        return [[id, recordId]]
      try {
        const value = inputValue(schema, values[id])
        return value === undefined ? [] : [[id, value]]
      } catch {
        throw new FormValidationError([
          {
            path: [id],
            reason: "INVALID_VALUE",
            message: `Enter a valid ${schema.label ?? id}.`,
          },
        ])
      }
    })
  )
  return Schema.decodeUnknownSync(toEffectOperationInput(action.input))(input, {
    errors: "all",
  })
}
