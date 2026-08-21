import type { AnySchema, PropertyDefinition } from "@continual/runtime"

export type ObjectTableCellType =
  | "boolean"
  | "date"
  | "domain"
  | "email"
  | "enum"
  | "number"
  | "phone"
  | "recordId"
  | "text"
  | "timestamp"
  | "url"
  | "readonly"

function resolveSchemaCellType(schema: AnySchema): ObjectTableCellType {
  switch (schema.kind) {
    case "boolean":
    case "enum":
    case "number":
    case "recordId":
      return schema.kind
    case "optional":
      return resolveSchemaCellType(schema.value)
    case "string":
      return schema.format ?? "text"
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
  const type = objectTableCellType(property)

  return (
    !property.immutable &&
    !property.outputOnly &&
    type !== "readonly" &&
    type !== "recordId"
  )
}

export function objectTableInputType(
  type: ObjectTableCellType
): "date" | "email" | "number" | "tel" | "text" | "url" {
  switch (type) {
    case "date":
      return "date"
    case "email":
      return "email"
    case "number":
      return "number"
    case "phone":
      return "tel"
    case "url":
      return "url"
    default:
      return "text"
  }
}
