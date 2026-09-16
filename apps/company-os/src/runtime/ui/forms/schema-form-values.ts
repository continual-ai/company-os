import { containsSecret } from "#/runtime/model/definition/schema.ts"
import type {
  AnySchema,
  StructSchema,
} from "#/runtime/model/definition/schema.ts"
import type { FormValue } from "#/runtime/ui/forms/form-value.ts"

export function isSupportedFormSchema(schema: AnySchema): boolean {
  if (schema.kind === "optional") return isSupportedFormSchema(schema.value)
  if (schema.kind === "literal") return true
  if (schema.kind === "struct")
    return Object.values(schema.properties).every(isSupportedFormSchema)
  if (schema.kind === "union")
    return (
      schema.discriminator !== undefined &&
      schema.members.every(isSupportedFormSchema)
    )
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
  const item = schema.items
  return (
    item.kind === "enum" ||
    (item.kind === "string" && !item.secret) ||
    item.kind === "file" ||
    item.kind === "image" ||
    item.kind === "media"
  )
}

function textValue(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : ""
}

function formObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

export function unionMember(
  schema: AnySchema,
  value: unknown
): StructSchema | undefined {
  if (schema.kind !== "union" || schema.discriminator === undefined)
    return undefined
  const tag = formObject(value)[schema.discriminator]
  return schema.members.find((member): member is StructSchema => {
    if (member.kind !== "struct") return false
    const field = member.properties[schema.discriminator!]
    return field?.kind === "literal" && field.value === tag
  })
}

/** Converts nested values to controlled inputs without losing booleans, zero, or absence. */
export function schemaFormDefault(
  schema: AnySchema,
  value: unknown = schema.default ??
    (schema.kind === "optional" ? schema.value.default : undefined),
  currency = "USD"
): FormValue {
  if (schema.kind === "optional")
    return value === undefined
      ? null
      : schemaFormDefault(schema.value, value, currency)
  if (schema.kind === "string" && schema.secret)
    return value !== null && typeof value === "object" && "hint" in value
      ? { hint: typeof value.hint === "string" ? value.hint : null }
      : (value === null || value === undefined) && schema.nullable
        ? null
        : ""
  if (
    schema.nullable &&
    isCompositeFormSchema(schema) &&
    (value === undefined || value === null)
  )
    return null
  if (schema.kind === "struct") {
    const source = formObject(value)
    return Object.fromEntries(
      Object.entries(schema.properties)
        .filter(([, child]) => !child.outputOnly)
        .map(([key, child]) => [
          key,
          schemaFormDefault(
            child,
            source[key] === undefined ? child.default : source[key],
            currency
          ),
        ])
    )
  }
  if (schema.kind === "union" && schema.discriminator !== undefined) {
    const member = unionMember(schema, value) ?? schema.members[0]!
    return schemaFormDefault(member, value, currency)
  }
  if (
    schema.kind === "string" &&
    schema.format === "timestamp" &&
    typeof value === "string"
  ) {
    const date = new Date(value)
    return Number.isNaN(date.valueOf())
      ? ""
      : new Date(date.valueOf() - date.getTimezoneOffset() * 60_000)
          .toISOString()
          .slice(0, 16)
  }
  if (schema.kind === "literal") return schema.value
  if (schema.kind === "boolean") return value === true
  if (schema.kind === "money") {
    const source = formObject(value)
    return {
      amount: textValue(source.amount),
      currency: textValue(source.currency) || currency,
    }
  }
  if (["file", "image", "media"].includes(schema.kind)) {
    const source = formObject(value)
    return {
      assetId: textValue(source.assetId),
      alt: textValue(source.alt),
    }
  }
  if (!isSupportedFormSchema(schema))
    return containsSecret(schema) || value === undefined || value === null
      ? ""
      : JSON.stringify(value)
  if (schema.kind === "array") {
    if (["file", "image", "media"].includes(schema.items.kind))
      return Array.isArray(value)
        ? value.map((item) => schemaFormDefault(schema.items, item, currency))
        : []
    return Array.isArray(value) ? value.join("\n") : ""
  }
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : ""
}

/** A struct is replaced as a whole; only the selected variant's fields are submitted. */
export function schemaFormInput(
  schema: AnySchema,
  raw: FormValue | undefined,
  currency = "USD"
): FormValue | undefined {
  if (schema.kind === "string" && schema.secret)
    return raw !== null && typeof raw === "object" ? undefined : raw
  if (schema.kind === "optional")
    return raw === null || raw === undefined
      ? undefined
      : schemaFormInput(schema.value, raw, currency)
  if (raw === null) return null
  if (raw === undefined || raw === "") {
    if (schema.default !== undefined)
      return schemaFormDefaultInput(schema, currency)
    if (schema.nullable) return null
  }
  if (schema.kind === "struct") {
    const source = formObject(raw)
    const result: Record<string, FormValue> = {}
    for (const [key, child] of Object.entries(schema.properties)) {
      if (child.outputOnly) continue
      const value = schemaFormInput(child, formValue(source[key]), currency)
      if (value !== undefined) result[key] = value
    }
    return result
  }
  if (schema.kind === "union" && schema.discriminator !== undefined) {
    const member = unionMember(schema, raw)
    return member ? schemaFormInput(member, raw, currency) : raw
  }
  if (!isSupportedFormSchema(schema))
    return typeof raw === "string" ? formValue(JSON.parse(raw)) : raw
  if (schema.kind === "literal") return schema.value
  if (schema.kind === "number") return raw === "" ? raw : Number(raw)
  if (schema.kind === "array" && typeof raw === "string")
    return raw
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  if (["file", "image", "media"].includes(schema.kind)) {
    const source = formObject(raw)
    const assetId = textValue(source.assetId).trim()
    const alt = textValue(source.alt).trim()
    return alt ? { assetId, alt } : { assetId }
  }
  if (schema.kind === "money") {
    const source = formObject(raw)
    return {
      amount: textValue(source.amount).trim(),
      currency: (textValue(source.currency) || currency).trim().toUpperCase(),
    }
  }
  if (
    schema.kind === "string" &&
    schema.format === "timestamp" &&
    typeof raw === "string" &&
    raw !== ""
  )
    return new Date(raw).toISOString()
  return raw
}

function schemaFormDefaultInput(
  schema: AnySchema,
  currency: string
): FormValue {
  // Defaults are model-owned values; the form conversion normalizes their nested controls.
  const value = schemaFormDefault(schema, schema.default, currency)
  const withoutDefault = { ...schema }
  delete withoutDefault.default
  return schemaFormInput(withoutDefault, value, currency) ?? null
}

function isCompositeFormSchema(schema: AnySchema): boolean {
  return (
    schema.kind === "struct" ||
    (schema.kind === "union" && schema.discriminator !== undefined)
  )
}

/** Dynamic form state is checked here instead of expanding recursive TanStack DeepKeys. */
export function formValue(value: unknown): FormValue | undefined {
  if (
    value === undefined ||
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  )
    return value
  if (Array.isArray(value)) return value.map((item) => formValue(item) ?? null)
  if (typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, formValue(item)])
    )
  return undefined
}
