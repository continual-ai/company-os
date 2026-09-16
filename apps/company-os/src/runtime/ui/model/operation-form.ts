import { Schema } from "effect"

import { toEffectOperationInput } from "#/runtime/contract/schema.ts"
import type { Action } from "#/runtime/model/index.ts"
import { FormValidationError } from "#/runtime/ui/forms/form-errors.ts"
import {
  formValue,
  schemaFormDefault,
  schemaFormInput,
} from "#/runtime/ui/forms/schema-form-values.ts"
import type { ObjectFormValues } from "#/runtime/ui/model/object-form.ts"

export function operationFormFields(action: Action, recordId?: string) {
  return Object.entries(action.input.properties)
    .filter(
      ([id]) =>
        !(action.scope === "record" && recordId !== undefined && id === "id")
    )
    .map(([id, definition]) => ({
      id,
      schema: definition,
      required:
        definition.kind !== "optional" &&
        !definition.nullable &&
        definition.default === undefined,
    }))
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
      .map(({ id, schema }) => [
        id,
        schemaFormDefault(
          schema,
          schema.kind === "optional" ? schema.value.default : schema.default
        ),
      ])
  )
}
export function decodeOperationForm(
  action: Action,
  values: ObjectFormValues,
  recordId?: string
) {
  const input = Object.fromEntries(
    Object.entries(action.input.properties).flatMap(([id, schema]) => {
      if (action.scope === "record" && id === "id" && recordId !== undefined)
        return [[id, recordId]]
      try {
        const value = schemaFormInput(schema, formValue(values[id]))
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
