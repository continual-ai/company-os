const httpMethods = ["get", "post", "put", "patch", "delete"] as const

export type HttpMethod = (typeof httpMethods)[number]
export type OpenApiExample =
  | boolean
  | number
  | string
  | null
  | ReadonlyArray<OpenApiExample>
  | { readonly [key: string]: OpenApiExample }

export interface OpenApiSchema {
  readonly $ref?: string
  readonly additionalProperties?: boolean | OpenApiSchema
  readonly allOf?: ReadonlyArray<OpenApiSchema>
  readonly anyOf?: ReadonlyArray<OpenApiSchema>
  readonly default?: OpenApiExample
  readonly description?: string
  readonly enum?: ReadonlyArray<OpenApiExample>
  readonly format?: string
  readonly items?: OpenApiSchema
  readonly properties?: Readonly<Record<string, OpenApiSchema>>
  readonly readOnly?: boolean
  readonly required?: ReadonlyArray<string>
  readonly oneOf?: ReadonlyArray<OpenApiSchema>
  readonly title?: string
  readonly type?: string | Array<string>
}

interface OpenApiMediaType {
  readonly schema?: OpenApiSchema
}

interface OpenApiParameter {
  readonly description?: string
  readonly in: string
  readonly name: string
  readonly required?: boolean
  readonly schema?: OpenApiSchema
}

interface OpenApiResponse {
  readonly content?: Readonly<Record<string, OpenApiMediaType>>
  readonly description: string
}

interface OpenApiOperationDefinition {
  readonly description?: string
  readonly operationId?: string
  readonly parameters?: ReadonlyArray<OpenApiParameter>
  readonly requestBody?: {
    readonly content?: Readonly<Record<string, OpenApiMediaType>>
    readonly required?: boolean
  }
  readonly responses?: Readonly<Record<string, OpenApiResponse>>
  readonly summary?: string
  readonly tags?: ReadonlyArray<string>
}

interface OpenApiPathItem {
  readonly delete?: OpenApiOperationDefinition
  readonly get?: OpenApiOperationDefinition
  readonly patch?: OpenApiOperationDefinition
  readonly post?: OpenApiOperationDefinition
  readonly put?: OpenApiOperationDefinition
}

export interface OpenApiDocument {
  readonly components?: {
    readonly schemas?: Readonly<Record<string, OpenApiSchema>>
  }
  readonly info: {
    readonly description?: string
    readonly title: string
    readonly version: string
  }
  readonly openapi: string
  readonly paths: Readonly<Record<string, OpenApiPathItem>>
  readonly tags?: ReadonlyArray<{
    readonly description?: string
    readonly name: string
  }>
}

function isObject(value: unknown): value is object {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/** Validates the stable top-level contract consumed by the API reference UI. */
export function isOpenApiDocument(value: unknown): value is OpenApiDocument {
  if (!isObject(value)) return false
  const info = Reflect.get(value, "info")
  const paths = Reflect.get(value, "paths")
  return (
    typeof Reflect.get(value, "openapi") === "string" &&
    isObject(info) &&
    typeof Reflect.get(info, "title") === "string" &&
    typeof Reflect.get(info, "version") === "string" &&
    isObject(paths)
  )
}

export interface OpenApiOperation extends OpenApiOperationDefinition {
  readonly method: HttpMethod
  readonly path: string
  readonly tag: string
}

export function operationsFromDocument(
  document: OpenApiDocument
): ReadonlyArray<OpenApiOperation> {
  return Object.entries(document.paths).flatMap(([path, pathItem]) =>
    httpMethods.flatMap((method) => {
      const operation = pathItem[method]
      return operation === undefined
        ? []
        : [
            {
              ...operation,
              method,
              path,
              tag: operation.tags?.[0] ?? "Other",
            },
          ]
    })
  )
}

export function filterOperations(
  operations: ReadonlyArray<OpenApiOperation>,
  query: string
): ReadonlyArray<OpenApiOperation> {
  const normalized = query.trim().toLowerCase()
  if (normalized.length === 0) return operations
  return operations.filter((operation) =>
    [
      operation.description,
      operation.method,
      operation.operationId,
      operation.path,
      operation.summary,
      operation.tag,
    ].some((value) => value?.toLowerCase().includes(normalized) === true)
  )
}

export function operationKey(operation: OpenApiOperation): string {
  return operation.operationId ?? `${operation.method}:${operation.path}`
}

export function schemaName(schema: OpenApiSchema | undefined) {
  return schema?.$ref?.split("/").at(-1)
}

export function resolveSchema(
  schema: OpenApiSchema | undefined,
  schemas: Readonly<Record<string, OpenApiSchema>>
): OpenApiSchema | undefined {
  const name = schemaName(schema)
  return name === undefined ? schema : (schemas[name] ?? schema)
}

export function schemaLabel(
  schema: OpenApiSchema | undefined
): string | undefined {
  if (schema === undefined) return undefined
  if (schema.$ref !== undefined) return schema.$ref.split("/").at(-1)
  const alternatives = schema.oneOf ?? schema.anyOf
  if (alternatives !== undefined) {
    return alternatives
      .map(schemaLabel)
      .filter((value): value is string => value !== undefined)
      .join(" | ")
  }
  if (schema.type === "array") {
    return `Array<${schemaLabel(schema.items) ?? "value"}>`
  }
  return Array.isArray(schema.type) ? schema.type.join(" | ") : schema.type
}

export function mediaSchema(
  content: Readonly<Record<string, OpenApiMediaType>> | undefined
): string | undefined {
  if (content === undefined) return undefined
  return schemaLabel(Object.values(content)[0]?.schema)
}

function firstUsefulAlternative(schema: OpenApiSchema) {
  const alternatives = schema.oneOf ?? schema.anyOf
  return alternatives?.find((alternative) => alternative.type !== "null")
}

export function exampleForSchema(
  schema: OpenApiSchema | undefined,
  schemas: Readonly<Record<string, OpenApiSchema>>,
  visited: ReadonlySet<string> = new Set()
): OpenApiExample | undefined {
  if (schema === undefined) return undefined

  const name = schemaName(schema)
  if (name !== undefined) {
    if (visited.has(name)) return name
    const resolved = schemas[name]
    if (resolved === undefined) return name
    return exampleForSchema(resolved, schemas, new Set([...visited, name]))
  }

  if (schema.default !== undefined) return schema.default
  if (schema.enum?.[0] !== undefined) return schema.enum[0]

  const alternative = firstUsefulAlternative(schema)
  if (alternative !== undefined) {
    return exampleForSchema(alternative, schemas, visited)
  }

  if (schema.type === "object" || schema.properties !== undefined) {
    const properties = Object.entries(schema.properties ?? {})
    const required = new Set(schema.required ?? [])
    const included =
      required.size > 0
        ? properties.filter(([property]) => required.has(property))
        : properties
            .filter(([, property]) => property.readOnly !== true)
            .slice(0, 3)
    const entries: Array<[string, OpenApiExample]> = []
    for (const [property, definition] of included) {
      const example = exampleForSchema(definition, schemas, visited)
      if (example !== undefined) entries.push([property, example])
    }
    return Object.fromEntries(entries)
  }
  if (schema.type === "array") {
    const item = exampleForSchema(schema.items, schemas, visited)
    return item === undefined ? [] : [item]
  }
  if (schema.type === "boolean") return false
  if (schema.type === "integer" || schema.type === "number") return 0
  if (schema.format === "date-time") return "2026-01-01T00:00:00Z"
  if (schema.format === "date") return "2026-01-01"
  if (schema.format === "email") return "person@example.com"
  if (schema.format === "uri") return "https://example.com"
  return "string"
}

export function curlExample(
  operation: OpenApiOperation,
  schemas: Readonly<Record<string, OpenApiSchema>>
) {
  const requestSchema = Object.values(operation.requestBody?.content ?? {})[0]
    ?.schema
  const body = exampleForSchema(requestSchema, schemas)
  const lines = [
    `curl -X ${operation.method.toUpperCase()} '${operation.path}'`,
    "  -H 'Accept: application/json'",
  ]
  if (requestSchema !== undefined) {
    lines.push(
      "  -H 'Content-Type: application/json'",
      `  --data '${JSON.stringify(body, null, 2)}'`
    )
  }
  return lines.join(" \\\n")
}
