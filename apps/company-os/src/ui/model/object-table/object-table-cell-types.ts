import type { AnySchema, PropertyDefinition } from "@company/runtime"

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/
const domainPattern = /^(?!-)(?:[a-z0-9-]+\.)+[a-z]{2,}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ObjectTableCellType =
  | "boolean"
  | "date"
  | "domain"
  | "email"
  | "enum"
  | "image"
  | "number"
  | "phone"
  | "recordId"
  | "tags"
  | "text"
  | "timestamp"
  | "url"
  | "readonly"

export interface ObjectTableCellBehavior {
  editable: boolean
  filterFamily: "boolean" | "date" | "number" | "recordId" | "text"
  inputType: "date" | "email" | "number" | "tel" | "text" | "url"
  overflow: "clip" | "expandLongText" | "expandValues"
}

const objectTableCellBehaviors = {
  boolean: {
    editable: true,
    filterFamily: "boolean",
    inputType: "text",
    overflow: "clip",
  },
  date: {
    editable: true,
    filterFamily: "date",
    inputType: "date",
    overflow: "clip",
  },
  domain: {
    editable: true,
    filterFamily: "text",
    inputType: "text",
    overflow: "clip",
  },
  email: {
    editable: true,
    filterFamily: "text",
    inputType: "email",
    overflow: "clip",
  },
  enum: {
    editable: true,
    filterFamily: "boolean",
    inputType: "text",
    overflow: "clip",
  },
  image: {
    editable: false,
    filterFamily: "text",
    inputType: "text",
    overflow: "clip",
  },
  number: {
    editable: true,
    filterFamily: "number",
    inputType: "number",
    overflow: "clip",
  },
  phone: {
    editable: true,
    filterFamily: "text",
    inputType: "tel",
    overflow: "clip",
  },
  readonly: {
    editable: false,
    filterFamily: "text",
    inputType: "text",
    overflow: "clip",
  },
  recordId: {
    editable: false,
    filterFamily: "recordId",
    inputType: "text",
    overflow: "clip",
  },
  tags: {
    editable: true,
    filterFamily: "text",
    inputType: "text",
    overflow: "expandValues",
  },
  text: {
    editable: true,
    filterFamily: "text",
    inputType: "text",
    overflow: "expandLongText",
  },
  timestamp: {
    editable: true,
    filterFamily: "date",
    inputType: "text",
    overflow: "clip",
  },
  url: {
    editable: true,
    filterFamily: "text",
    inputType: "url",
    overflow: "clip",
  },
} as const satisfies Record<ObjectTableCellType, ObjectTableCellBehavior>

export function objectTablePropertySchema(schema: AnySchema): AnySchema {
  return schema.kind === "optional"
    ? objectTablePropertySchema(schema.value)
    : schema
}

function resolveSchemaCellType(schema: AnySchema): ObjectTableCellType {
  const resolvedSchema = objectTablePropertySchema(schema)

  switch (resolvedSchema.kind) {
    case "boolean":
    case "enum":
    case "image":
    case "number":
    case "recordId":
      return resolvedSchema.kind
    case "money":
      return "readonly"
    case "string":
      return resolvedSchema.format ?? "text"
    case "array": {
      const itemSchema = objectTablePropertySchema(resolvedSchema.items)
      return itemSchema.kind === "enum" || itemSchema.kind === "string"
        ? "tags"
        : "readonly"
    }
    default:
      return "readonly"
  }
}

export function objectTableCellType(
  property: PropertyDefinition
): ObjectTableCellType {
  return resolveSchemaCellType(property)
}

export function isObjectTableCellEditable(
  property: PropertyDefinition
): boolean {
  return (
    !property.immutable &&
    !property.outputOnly &&
    objectTableCellBehavior(property).editable
  )
}

export function objectTableCellBehavior(
  property: PropertyDefinition
): ObjectTableCellBehavior {
  return objectTableCellBehaviors[objectTableCellType(property)]
}

export function objectTableCellShouldExpand(
  property: PropertyDefinition,
  measurement: { displayLength: number; valueCount: number }
): boolean {
  const overflow = objectTableCellBehavior(property).overflow
  if (overflow === "expandValues") {
    return measurement.valueCount > 2 || measurement.displayLength > 28
  }
  return overflow === "expandLongText" && measurement.displayLength > 40
}

export type ObjectTableCellInputResult =
  | { value: null | number | string }
  | { error: string }

function normalizePhoneNumber(input: string): ObjectTableCellInputResult {
  const digits = input.replace(/\D/g, "")
  if (digits.length === 0) return { value: null }
  if (
    input.trim().startsWith("+") &&
    digits.length >= 7 &&
    digits.length <= 15
  ) {
    return { value: `+${digits}` }
  }
  return {
    error: "Enter an international phone number, such as +1 415 555 0123.",
  }
}

function isRealCalendarDate(value: string): boolean {
  if (!calendarDatePattern.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

export function parseObjectTableCellInput(
  property: PropertyDefinition,
  input: string
): ObjectTableCellInputResult {
  const type = objectTableCellType(property)
  const trimmed = input.trim()
  if (trimmed.length === 0) {
    return property.nullable
      ? { value: null }
      : { error: "A value is required." }
  }

  if (type === "number") {
    const value = Number(trimmed)
    if (!Number.isFinite(value)) return { error: "Enter a valid number." }
    const schema = objectTablePropertySchema(property)
    if (schema.kind === "number") {
      if (schema.integer && !Number.isInteger(value)) {
        return { error: "Enter a whole number." }
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return { error: `Enter a value of at least ${schema.minimum}.` }
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return { error: `Enter a value no greater than ${schema.maximum}.` }
      }
    }
    return { value }
  }

  if (type === "email") {
    const value = trimmed.toLowerCase()
    return emailPattern.test(value)
      ? { value }
      : { error: "Enter a valid email address." }
  }
  if (type === "domain") {
    const value = trimmed.toLowerCase().replace(/\.$/, "")
    return domainPattern.test(value)
      ? { value }
      : { error: "Enter a valid domain, such as example.com." }
  }
  if (type === "phone") return normalizePhoneNumber(trimmed)
  if (type === "url") {
    try {
      const url = new URL(trimmed)
      return url.protocol === "http:" || url.protocol === "https:"
        ? { value: url.href }
        : { error: "Use an HTTP or HTTPS URL." }
    } catch {
      return { error: "Enter a complete URL, including https://." }
    }
  }
  if (type === "date") {
    return isRealCalendarDate(trimmed)
      ? { value: trimmed }
      : { error: "Enter a valid date in YYYY-MM-DD format." }
  }
  if (type === "timestamp") {
    const date = new Date(trimmed)
    return Number.isNaN(date.getTime())
      ? { error: "Enter a valid date and time." }
      : { value: date.toISOString() }
  }

  const schema = objectTablePropertySchema(property)
  if (schema.kind === "string") {
    if (schema.minLength !== undefined && input.length < schema.minLength) {
      return { error: `Enter at least ${schema.minLength} characters.` }
    }
    if (schema.maxLength !== undefined && input.length > schema.maxLength) {
      return { error: `Enter no more than ${schema.maxLength} characters.` }
    }
  }
  return { value: input }
}

export function objectTableInputType(
  type: ObjectTableCellType
): "date" | "email" | "number" | "tel" | "text" | "url" {
  return objectTableCellBehaviors[type].inputType
}

export function objectTableLinkHref(
  type: ObjectTableCellType,
  value: string
): string | null {
  const trimmedValue = value.trim()
  if (trimmedValue.length === 0) return null

  switch (type) {
    case "url": {
      try {
        const url = new URL(trimmedValue)
        return url.protocol === "http:" || url.protocol === "https:"
          ? url.href
          : null
      } catch {
        return null
      }
    }
    default:
      return null
  }
}

export function objectTableUrlDisplayValue(value: string): string {
  try {
    const url = new URL(value)
    const path = url.pathname === "/" ? "" : url.pathname
    return `${url.host}${path}${url.search}${url.hash}`
  } catch {
    return value
  }
}
