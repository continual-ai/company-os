import type { AnySchema } from "./definition/schema"
import type { ModelDescription } from "./description"

export interface ModelDiagnostic {
  readonly message: string
  readonly path: ReadonlyArray<string>
  readonly ruleId: string
  readonly severity: "error" | "warning"
}

interface NamedSchema {
  readonly id: string
  readonly schema: AnySchema
}

const standardCodeFields = new Set([
  "currencyCode",
  "languageCode",
  "regionCode",
  "timeZone",
])

function error(
  diagnostics: Array<ModelDiagnostic>,
  ruleId: string,
  path: ReadonlyArray<string>,
  message: string
): void {
  diagnostics.push({ message, path, ruleId, severity: "error" })
}

function startsWithUppercase(value: string): boolean {
  const firstLetter = value.match(/\p{L}/u)?.[0]
  return firstLetter === undefined || firstLetter === firstLetter.toUpperCase()
}

function lintText(
  diagnostics: Array<ModelDiagnostic>,
  path: ReadonlyArray<string>,
  text: {
    readonly description?: string
    readonly label?: string
    readonly name?: string
    readonly pluralName?: string
  }
): void {
  for (const field of ["name", "pluralName"] as const) {
    const value = text[field]
    if (value !== undefined && !startsWithUppercase(value)) {
      error(
        diagnostics,
        "model/display-name-sentence-case",
        [...path, field],
        `${field === "name" ? "Name" : "Plural name"} '${value}' must start with an uppercase letter.`
      )
    }
  }
  if (text.label !== undefined && !startsWithUppercase(text.label)) {
    error(
      diagnostics,
      "model/label-sentence-case",
      [...path, "label"],
      `Label '${text.label}' must start with an uppercase letter.`
    )
  }
  if (
    text.description !== undefined &&
    !/[.!?]$/.test(text.description.trim())
  ) {
    error(
      diagnostics,
      "model/description-sentence",
      [...path, "description"],
      "Descriptions must be complete sentences ending in punctuation."
    )
  }
}

function lintProperty(
  diagnostics: Array<ModelDiagnostic>,
  path: ReadonlyArray<string>,
  { id, schema }: NamedSchema
): void {
  lintNestedSchema(diagnostics, path, schema)

  const valueSchema = unwrapOptional(schema)

  if (
    valueSchema.kind === "string" &&
    valueSchema.format === "timestamp" &&
    !id.endsWith("At")
  ) {
    error(
      diagnostics,
      "model/timestamp-suffix",
      path,
      `Timestamp property '${id}' must end with 'At'.`
    )
  }
  if (
    valueSchema.kind === "string" &&
    valueSchema.format === "date" &&
    !id.endsWith("Date")
  ) {
    error(
      diagnostics,
      "model/date-suffix",
      path,
      `Civil-date property '${id}' must end with 'Date'.`
    )
  }
  if (valueSchema.kind === "boolean" && /^is[A-Z]/.test(id)) {
    error(
      diagnostics,
      "model/boolean-name",
      path,
      `Boolean property '${id}' must describe the condition without an 'is' prefix.`
    )
  }
  if (/^num(?:[A-Z]|$)/.test(id) || /^numberOf[A-Z]/.test(id)) {
    error(
      diagnostics,
      "model/count-name",
      path,
      `Count property '${id}' must use a semantic name ending in 'Count'.`
    )
  }
  if (id.endsWith("Count") && valueSchema.kind !== "number") {
    error(
      diagnostics,
      "model/count-type",
      path,
      `Count property '${id}' must use a number schema.`
    )
  }
  if (standardCodeFields.has(id) && valueSchema.kind !== "string") {
    error(
      diagnostics,
      "model/standard-code-type",
      path,
      `Standardized code property '${id}' must use a canonical string schema rather than an enum or number.`
    )
  }
}

function lintNestedSchema(
  diagnostics: Array<ModelDiagnostic>,
  path: ReadonlyArray<string>,
  schema: AnySchema
): void {
  lintText(diagnostics, path, schema)

  if (schema.kind === "enum") {
    schema.options?.forEach((option, index) => {
      lintText(diagnostics, [...path, "options", String(index)], option)
    })
  }

  switch (schema.kind) {
    case "array":
      lintNestedSchema(diagnostics, [...path, "items"], schema.items)
      break
    case "map":
      lintNestedSchema(diagnostics, [...path, "values"], schema.values)
      break
    case "optional":
      lintNestedSchema(diagnostics, [...path, "value"], schema.value)
      break
    case "struct":
      lintProperties(diagnostics, path, schema.properties)
      break
    case "union":
      schema.members.forEach((member, index) => {
        lintNestedSchema(
          diagnostics,
          [...path, "members", String(index)],
          member
        )
      })
      break
  }
}

function unwrapOptional(schema: AnySchema): AnySchema {
  return schema.kind === "optional" ? unwrapOptional(schema.value) : schema
}

function lintProperties(
  diagnostics: Array<ModelDiagnostic>,
  path: ReadonlyArray<string>,
  properties: Readonly<Record<string, AnySchema>>
): void {
  for (const [id, schema] of Object.entries(properties)) {
    lintProperty(diagnostics, [...path, "properties", id], { id, schema })
  }
}

/** Checks Company OS naming and documentation policy on normalized model truth. */
export function lintModelDescription(
  description: ModelDescription
): ReadonlyArray<ModelDiagnostic> {
  const diagnostics: Array<ModelDiagnostic> = []

  lintText(diagnostics, ["model"], description.model)
  lintText(diagnostics, ["root", description.root.id], description.root)

  for (const module of description.modules) {
    lintText(diagnostics, ["modules", module.id], module)
  }

  for (const object of description.objects) {
    const path = ["objects", object.id]
    lintText(diagnostics, path, object)
    lintProperties(diagnostics, path, object.properties)
  }
  for (const item of description.interfaces) {
    const path = ["interfaces", item.id]
    lintText(diagnostics, path, item)
    lintProperties(diagnostics, path, item.properties)
  }
  for (const link of description.links) {
    lintText(diagnostics, ["links", link.id], link)
    lintText(diagnostics, ["links", link.id, "forward"], link.forward)
    lintText(diagnostics, ["links", link.id, "reverse"], link.reverse)
  }
  for (const action of description.actions) {
    const path = ["actions", action.objectType, action.id]
    lintText(diagnostics, path, action)
    lintProperty(diagnostics, [...path, "input"], {
      id: "input",
      schema: action.input,
    })
    lintProperty(diagnostics, [...path, "output"], {
      id: "output",
      schema: action.output,
    })
  }
  for (const query of description.queries) {
    lintText(diagnostics, ["queries", query.objectType, query.id], query)
  }

  return diagnostics
}
