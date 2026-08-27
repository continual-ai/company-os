/* oxlint-disable anti-slop/no-runtime-typeof */
import { Model, modelMetadata } from "@company/model"
import {
  modelObjectLinkTraversals,
  type AnySchema,
  type ModelLinkTraversal,
  type PropertyDefinition,
  type Violation,
} from "@company/runtime"
import {
  toEffectModelObjectCreateSchema,
  toEffectObjectUpdateSchema,
} from "@company/runtime/effect"

import { decodeFormSchema, FormValidationError } from "@/ui/forms/form-errors"
import type { FormValue, FormValueObject } from "@/ui/forms/form-value"

import {
  modelObjectProperty,
  type ClientRecord,
  type ClientValue,
  type ModelObject,
} from "./object-client"
import { objectTablePropertySchema } from "./object-table/object-table-cell-types"

export type ObjectFormMode = "create" | "edit"
export interface ObjectFormValues {
  readonly [property: string]: FormValue
}
type ObjectFormInputValue =
  | boolean
  | null
  | number
  | string
  | ReadonlyArray<ObjectFormInputValue>
  | { readonly [property: string]: ObjectFormInputValue | undefined }
  | { readonly alt?: string; readonly assetId: string }
  | { readonly amount: string; readonly currency: string }
export interface ObjectFormInput {
  readonly [property: string]: ObjectFormInputValue | undefined
}

export interface ObjectFormProperty {
  readonly id: string
  readonly property: PropertyDefinition
  readonly schema: AnySchema
}

export function objectFormLinks(
  object: ModelObject,
  mode: ObjectFormMode
): ReadonlyArray<ModelLinkTraversal> {
  return mode === "create"
    ? modelObjectLinkTraversals(Model, object).filter(
        ({ initializable }) => initializable
      )
    : []
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
  values: ObjectFormValues,
  propertyId: string,
  property: PropertyDefinition,
  schema: AnySchema,
  mode: ObjectFormMode
): FormValue | undefined {
  const raw = values[propertyId]
  if (schema.kind === "boolean") return raw === true

  if (schema.kind === "money") {
    const amount = nestedString(raw, "amount").trim()
    const currency = nestedString(raw, "currency").trim().toUpperCase()
    if (amount === "") return blankValue(propertyId, property, mode)
    return { amount, currency: currency || modelMetadata.defaultCurrency }
  }

  if (
    schema.kind === "file" ||
    schema.kind === "image" ||
    schema.kind === "media"
  ) {
    const assetId = nestedString(raw, "assetId").trim()
    if (assetId === "") return blankValue(propertyId, property, mode)
    const alt = nestedString(raw, "alt").trim()
    return alt === "" ? { assetId } : { alt, assetId }
  }

  if (schema.kind === "array") {
    const value = stringValue(raw).trim()
    if (value === "") return []
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
  }

  const value = stringValue(raw).trim()
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
  values: ObjectFormValues,
  mode: ObjectFormMode
): ObjectFormInput {
  const input: Record<string, FormValue> = {}
  if (mode === "create" && object.parent.kind !== "root") {
    const parent = stringValue(values.parent).trim()
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
    const value = scalarValue(values, id, property, schema, mode)
    if (value !== undefined) input[id] = value
  }
  if (mode === "create") {
    const links: Record<string, string | ReadonlyArray<string>> = {}
    const linkValues = values.links
    for (const { traversal } of objectFormLinks(object, mode)) {
      const rawValue = nestedFormValue(linkValues, traversal.key)
      const targets =
        traversal.cardinality === "many"
          ? stringArrayValue(rawValue)
          : [stringValue(rawValue).trim()].filter((value) => value !== "")
      if (targets.length === 0) {
        if (traversal.cardinality === "one") {
          throw new FormValidationError([
            {
              message: `${traversal.label} is required.`,
              path: ["links", traversal.key],
              reason: "REQUIRED",
            },
          ])
        }
        continue
      }
      links[traversal.key] =
        traversal.cardinality === "many" ? targets : targets[0]!
    }
    if (Object.keys(links).length > 0) input.links = links
  }
  const schema =
    mode === "create"
      ? toEffectModelObjectCreateSchema(Model, object)
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

function nestedString(value: FormValue | undefined, key: string): string {
  return isObjectFormObject(value) ? stringValue(value[key]) : ""
}

function nestedFormValue(
  value: FormValue | undefined,
  key: string
): FormValue | undefined {
  return isObjectFormObject(value) ? value[key] : undefined
}

function stringArrayValue(value: FormValue | undefined): ReadonlyArray<string> {
  return Array.isArray(value)
    ? value.map((item) => item.trim()).filter((item) => item.length > 0)
    : []
}

function isObjectFormObject(
  value: FormValue | undefined
): value is FormValueObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function initialValue(
  property: PropertyDefinition,
  record: ClientRecord | undefined,
  propertyId: string
): ClientValue | undefined {
  if (record !== undefined) return record[propertyId]
  // SAFETY: portable property defaults are JSON-compatible values by schema.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return property.default as ClientValue | undefined
}

export function objectFormDefaultValues(
  object: ModelObject,
  mode: ObjectFormMode,
  record?: ClientRecord
): ObjectFormValues {
  const values: Record<string, FormValue> = {}
  if (mode === "create" && object.parent.kind !== "root") values.parent = ""

  for (const { id, property, schema } of objectFormProperties(object, mode)) {
    const value = initialValue(property, record, id)
    if (schema.kind === "boolean") {
      values[id] = value === true
      continue
    }
    if (schema.kind === "money") {
      const money =
        typeof value === "object" &&
        value !== null &&
        "amount" in value &&
        "currency" in value
          ? value
          : undefined
      values[id] = {
        amount: stringValue(money?.amount),
        currency: stringValue(money?.currency) || modelMetadata.defaultCurrency,
      }
      continue
    }
    if (
      schema.kind === "file" ||
      schema.kind === "image" ||
      schema.kind === "media"
    ) {
      const media =
        typeof value === "object" && value !== null && "assetId" in value
          ? value
          : undefined
      values[id] = {
        alt:
          media !== undefined && "alt" in media ? stringValue(media.alt) : "",
        assetId: stringValue(media?.assetId),
      }
      continue
    }
    if (schema.kind === "array") {
      values[id] = Array.isArray(value) ? value.join("\n") : ""
      continue
    }
    if (schema.kind === "string" && schema.format === "timestamp") {
      values[id] = dateTimeLocalValue(value)
      continue
    }
    values[id] = typeof value === "number" ? String(value) : stringValue(value)
  }

  if (mode === "create") {
    const links: Record<string, string | ReadonlyArray<string>> = {}
    for (const { traversal } of objectFormLinks(object, mode)) {
      links[traversal.key] = traversal.cardinality === "many" ? [] : ""
    }
    if (Object.keys(links).length > 0) values.links = links
  }
  return values
}

export function dateTimeLocalValue(value: ClientValue | undefined): string {
  if (typeof value !== "string" || value === "") return ""
  const date = new Date(value)
  if (Number.isNaN(date.valueOf())) return ""
  const local = new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

export function stringValue(
  value: ClientValue | FormValue | undefined
): string {
  return typeof value === "string" ? value : ""
}
