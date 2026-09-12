import { Schema } from "effect"

import {
  customMethodParameter,
  customMethodParams,
  customMethodPath,
} from "#/runtime/contract/http-custom-method.ts"
import {
  modelOperations,
  type ModelOperation,
} from "#/runtime/contract/operations.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"

export interface HttpOperation {
  readonly operation: ModelOperation
  readonly identifier: string
  readonly group: string
  readonly method: "GET" | "POST" | "PATCH" | "DELETE"
  readonly path: `/${string}`
  readonly params: Schema.Struct<
    Readonly<Record<string, Schema.Codec<unknown, unknown>>>
  >
  readonly input: Schema.Struct<
    Readonly<Record<string, Schema.Codec<unknown, unknown>>>
  >
  readonly inputLocation: "query" | "payload"
  readonly status: 200 | 201 | 204
  readonly customMethod?: string
  readonly pathFields: ReadonlyArray<string>
}

function pascalCase(value: string) {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

type HttpConvention = Pick<
  HttpOperation,
  "method" | "status" | "customMethod"
> & {
  readonly collectionName: boolean
}

function httpConvention(operation: ModelOperation): HttpConvention {
  const { id, linkTraversal, scope } = operation
  if (scope === "global")
    return {
      method: "POST",
      status: 200,
      customMethod: id,
      collectionName: false,
    }
  if (linkTraversal !== undefined) {
    return id === "list"
      ? { method: "GET", status: 200, collectionName: false }
      : { method: "POST", status: 204, customMethod: id, collectionName: false }
  }
  switch (id) {
    case "get":
      return { method: "GET", status: 200, collectionName: false }
    case "list":
      return { method: "GET", status: 200, collectionName: true }
    case "create":
      return { method: "POST", status: 201, collectionName: false }
    case "update":
      return { method: "PATCH", status: 200, collectionName: false }
    case "delete":
      return { method: "DELETE", status: 204, collectionName: false }
    case "batchGet":
      return {
        method: "POST",
        status: 200,
        customMethod: id,
        collectionName: true,
      }
    case "batchDelete":
      return {
        method: "POST",
        status: 204,
        customMethod: id,
        collectionName: true,
      }
    default:
      return {
        method: "POST",
        status: 200,
        customMethod: id,
        collectionName: scope === "collection",
      }
  }
}

/** HTTP owns only route naming, field placement, serialization, and success status. */
export function httpOperation(
  operation: ModelOperation,
  basePath: `/${string}` = "/api/v1"
): HttpOperation {
  const { id, object, linkTraversal, scope } = operation
  const { method, status, customMethod, collectionName } =
    httpConvention(operation)
  const collection = `${basePath}/${object?.collection ?? ""}` as const
  const resource =
    scope === "object" ? (`${collection}/:id` as const) : collection
  const path = linkTraversal
    ? (`${resource}/${linkTraversal.traversal.key}` as const)
    : resource
  const identifier = linkTraversal
    ? `${id}${pascalCase(object?.id ?? "")}${pascalCase(linkTraversal.traversal.key)}`
    : `${id}${pascalCase(object ? (collectionName ? object.collection : object.id) : "")}`
  const pathFields = scope === "object" ? ["id"] : []
  const fields = Object.fromEntries(
    Object.entries(operation.input.fields).filter(
      ([key]) => !pathFields.includes(key)
    )
  )
  const inputLocation =
    method === "GET" || method === "DELETE" ? "query" : "payload"
  // Structured list expressions use JSON only in URL parameters; MCP and domain inputs stay structured.
  if (inputLocation === "query") {
    for (const key of ["filter", "sort"]) {
      if (fields[key] !== undefined)
        fields[key] = Schema.optionalKey(Schema.fromJsonString(fields[key]))
    }
  }
  return {
    operation,
    group: object?.id ?? "$global",
    identifier,
    method,
    path:
      customMethod === undefined ? path : customMethodPath(path, customMethod),
    params: Schema.Struct({
      ...Object.fromEntries(
        pathFields.map((key) => [key, operation.input.fields[key]!])
      ),
      ...(customMethod === undefined
        ? {}
        : { [customMethod]: customMethodParameter(customMethod) }),
    }),
    input:
      pathFields.length === 0 && inputLocation === "payload"
        ? operation.input
        : Schema.Struct(fields).annotate({
            identifier: `${pascalCase(object?.id ?? "")}${linkTraversal ? pascalCase(linkTraversal.traversal.key) : ""}${pascalCase(id)}Input`,
          }),
    inputLocation,
    status,
    pathFields,
    ...(customMethod === undefined ? {} : { customMethod }),
  }
}

/** Packages canonical arguments for Effect's generated HTTP client. */
export function httpOperationRequest(
  http: HttpOperation,
  input: Readonly<Record<string, unknown>>
) {
  const params = Object.fromEntries(
    http.pathFields.map((key) => [key, input[key]])
  )
  return {
    params:
      http.customMethod === undefined
        ? params
        : customMethodParams(http.customMethod, params),
    [http.inputLocation]: Object.fromEntries(
      Object.entries(input).filter(([key]) => !http.pathFields.includes(key))
    ),
  }
}

/** Reassembles canonical arguments, excluding adapter-only route parameters. */
export function httpOperationInput(
  http: HttpOperation,
  request: {
    readonly params?: Readonly<Record<string, unknown>>
    readonly payload?: Readonly<Record<string, unknown>>
    readonly query?: Readonly<Record<string, unknown>>
  }
) {
  return {
    ...request[http.inputLocation],
    ...Object.fromEntries(
      http.pathFields.map((key) => [key, request.params?.[key]])
    ),
  }
}

/** The same HTTP groups drive declaration and handler binding, including global operations. */
export function httpOperationGroups(
  model: ModelCatalog,
  basePath?: `/${string}`
) {
  const groups = new Map<
    string,
    {
      id: string
      title: string
      description: string
      operations: HttpOperation[]
    }
  >()
  const identifiers = new Set<string>()
  for (const operation of modelOperations(model)) {
    const http = httpOperation(operation, basePath)
    if (identifiers.has(http.identifier))
      throw new Error(
        `Operation '${operation.key}' produces duplicate OpenAPI operationId '${http.identifier}'. Rename the operation to keep generated clients unambiguous.`
      )
    identifiers.add(http.identifier)
    let group = groups.get(http.group)
    if (!group) {
      group = {
        id: http.group,
        title: operation.object?.pluralName ?? model.name,
        description:
          operation.object?.description ??
          `Global operations for ${model.name}.`,
        operations: [],
      }
      groups.set(http.group, group)
    }
    group.operations.push(http)
  }
  return [...groups.values()]
}
