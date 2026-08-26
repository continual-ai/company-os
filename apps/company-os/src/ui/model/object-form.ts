/* oxlint-disable anti-slop/no-runtime-typeof */
import { modelMetadata } from "@company/model"
import type { AnySchema, PropertyDefinition, Violation } from "@company/runtime"
import {
  toEffectObjectCreateSchema,
  toEffectObjectUpdateSchema,
} from "@company/runtime/effect"

import { formText } from "@/form-data"

import { decodeFormSchema, FormValidationError } from "./form-errors"
import {
  modelObjectProperty,
  type ClientValue,
  type ModelObject,
} from "./object-client"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"

export type ObjectFormMode = "create" | "edit"
type ObjectFormValue =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<string>
  | { readonly alt?: string; readonly assetId: string }
  | { readonly amount: string; readonly currency: string }
export interface ObjectFormInput {
  readonly [property: string]: ObjectFormValue
}

export interface ObjectFormProperty {
  readonly id: string
  readonly property: PropertyDefinition
  readonly schema: AnySchema
}

export function objectFormProperties(
  object: ModelObject,
  mode: ObjectFormMode
): ReadonlyArray<ObjectFormProperty> {
  return Object.entries(object.properties).flatMap(([id, property]) => {
    if (property.outputOnly || (mode === "edit" && property.immutable))
      return []
    return [{ id, property, schema: objectTablePropertySchema(property) }]
  })
}

export function isSupportedFormSchema(schema: AnySchema): boolean {
  if (
    schema.kind === "boolean" ||
    schema.kind === "decimal" ||
    schema.kind === "enum" ||
    schema.kind === "file" ||
    schema.kind === "image" ||
    schema.kind === "media" ||
    schema.kind === "money" ||
    schema.kind === "number" ||
    schema.kind === "recordId" ||
    schema.kind === "string"
  ) {
    return true
  }
  if (schema.kind !== "array") return false
  const item = objectTablePropertySchema(schema.items)
  return item.kind === "enum" || item.kind === "string"
}

function semanticFormViolation(
  object: ModelObject,
  violation: Violation
): Violation {
  const propertyId = violation.path?.[0]
  if (typeof propertyId !== "string") return violation
  const property = modelObjectProperty(object, propertyId)
  if (property === undefined) return violation
  const schema = objectTablePropertySchema(property)
  const label = property.label ?? propertyId
  const nestedProperty = violation.path?.[1]

  if (schema.kind === "money" && nestedProperty === "amount") {
    return {
      ...violation,
      message: `${label} must be a valid decimal amount.`,
      reason: "INVALID_DECIMAL",
    }
  }
  if (schema.kind === "money" && nestedProperty === "currency") {
    return {
      ...violation,
      message: "Enter a valid three-letter currency code.",
      reason: "INVALID_CURRENCY",
    }
  }
  if (schema.kind === "number") {
    return {
      ...violation,
      message: `${label} must be a valid number.`,
      reason: "INVALID_NUMBER",
    }
  }
  if (schema.kind === "decimal") {
    return {
      ...violation,
      message: `${label} must be a valid decimal amount.`,
      reason: "INVALID_DECIMAL",
    }
  }
  if (schema.kind === "enum") {
    return {
      ...violation,
      message: `Select a valid ${label.toLowerCase()}.`,
      reason: "INVALID_OPTION",
    }
  }
  if (schema.kind !== "string" || schema.format === undefined) {
    return { ...violation, message: `${label} is invalid.` }
  }

  const format = {
    date: ["date", "INVALID_DATE"],
    domain: ["domain name", "INVALID_DOMAIN"],
    email: ["email address", "INVALID_EMAIL"],
    phone: ["phone number", "INVALID_PHONE"],
    timestamp: ["date and time", "INVALID_TIMESTAMP"],
    url: ["HTTP or HTTPS URL", "INVALID_URL"],
  } as const
  const [description, reason] = format[schema.format]
  return {
    ...violation,
    message: `Enter a valid ${description}.`,
    reason,
  }
}

function blankValue(
  propertyId: string,
  property: PropertyDefinition,
  mode: ObjectFormMode
): null | undefined {
  if (mode === "create" && Object.hasOwn(property, "default")) return undefined
  if (property.nullable) return null
  throw new FormValidationError([
    {
      message: `${property.label ?? propertyId} is required.`,
      path: [propertyId],
      reason: "REQUIRED",
    },
  ])
}

function scalarValue(
  form: FormData,
  propertyId: string,
  property: PropertyDefinition,
  schema: AnySchema,
  mode: ObjectFormMode
): ObjectFormValue | undefined {
  if (schema.kind === "boolean") return form.has(propertyId)

  if (schema.kind === "money") {
    const amount = formText(form, `${propertyId}.amount`).trim()
    const currency = formText(form, `${propertyId}.currency`)
      .trim()
      .toUpperCase()
    if (amount === "") return blankValue(propertyId, property, mode)
    return { amount, currency: currency || modelMetadata.defaultCurrency }
  }

  if (
    schema.kind === "file" ||
    schema.kind === "image" ||
    schema.kind === "media"
  ) {
    const assetId = formText(form, `${propertyId}.assetId`).trim()
    if (assetId === "") return blankValue(propertyId, property, mode)
    const alt = formText(form, `${propertyId}.alt`).trim()
    return alt === "" ? { assetId } : { alt, assetId }
  }

  if (schema.kind === "array") {
    const value = formText(form, propertyId).trim()
    if (value === "") return []
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const value = formText(form, propertyId).trim()
  if (value === "") return blankValue(propertyId, property, mode)
  if (schema.kind === "number") {
    const number = Number(value)
    if (!Number.isFinite(number)) {
      throw new FormValidationError([
        {
          message: `${property.label ?? propertyId} must be a number.`,
          path: [propertyId],
          reason: "INVALID_NUMBER",
        },
      ])
    }
    return number
  }
  if (schema.kind === "string" && schema.format === "timestamp") {
    const timestamp = new Date(value)
    if (Number.isNaN(timestamp.valueOf())) {
      throw new FormValidationError([
        {
          message: `${property.label ?? propertyId} must be a valid time.`,
          path: [propertyId],
          reason: "INVALID_TIMESTAMP",
        },
      ])
    }
    return timestamp.toISOString()
  }
  return value
}

export function decodeObjectForm(
  object: ModelObject,
  form: FormData,
  mode: ObjectFormMode
): ObjectFormInput {
  const input: Record<string, ObjectFormValue> = {}
  if (mode === "create" && object.parent.kind !== "root") {
    const parent = formText(form, "parent").trim()
    if (parent === "") {
      throw new FormValidationError([
        {
          message: "Parent is required.",
          path: ["parent"],
          reason: "REQUIRED",
        },
      ])
    }
    input.parent = parent
  }

  for (const { id, property, schema } of objectFormProperties(object, mode)) {
    if (!isSupportedFormSchema(schema)) {
      throw new FormValidationError([
        {
          message: `${property.label ?? id} cannot be edited by this form yet.`,
          path: [id],
          reason: "UNSUPPORTED",
        },
      ])
    }
    const value = scalarValue(form, id, property, schema, mode)
    if (value !== undefined) input[id] = value
  }
  const schema =
    mode === "create"
      ? toEffectObjectCreateSchema(object)
      : toEffectObjectUpdateSchema(object)
  let decoded: unknown
  try {
    decoded = decodeFormSchema(schema, input)
  } catch (cause) {
    if (!(cause instanceof FormValidationError)) throw cause
    throw new FormValidationError(
      cause.violations.map((violation) =>
        semanticFormViolation(object, violation)
      )
    )
  }
  // SAFETY: schema is compiled from the object whose properties built input.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return decoded as ObjectFormInput
}

export function dateTimeLocalValue(value: ClientValue | undefined): string {
  if (typeof value !== "string" || value === "") return ""
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ""
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function stringValue(value: ClientValue | undefined): string {
  return typeof value === "string" ? value : ""
}
