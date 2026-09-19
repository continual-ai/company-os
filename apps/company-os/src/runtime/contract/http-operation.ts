import { Schema } from "effect"

import {
  operationContracts,
  type OperationContract,
} from "#/runtime/contract/operation-contract.ts"
import type { ModelCatalog } from "#/runtime/model/definition/model.ts"

export interface HttpOperation {
  readonly operation: OperationContract
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
}

function pascalCase(value: string) {
  return value
    .replace(/(^|[^a-zA-Z0-9]+)([a-zA-Z0-9])/g, (_match, _prefix, char) =>
      char.toUpperCase()
    )
    .replace(/[^a-zA-Z0-9]/g, "")
}

type HttpConvention = Pick<HttpOperation, "method" | "status"> & {
  readonly customMethod?: string
}

function httpConvention(operation: OperationContract): HttpConvention {
  const { id, linkTraversal, scope } = operation
  if (scope === "global" || operation.builtin)
    return {
      method: "POST",
      status: 200,
      customMethod: id,
    }
  if (linkTraversal !== undefined) {
    return id === "list" || id === "get"
      ? { method: "GET", status: 200 }
      : { method: "POST", status: 204, customMethod: id }
  }
  switch (id) {
    case "get":
    case "list":
      return { method: "GET", status: 200 }
    case "create":
      return { method: "POST", status: 201 }
    case "update":
      return { method: "PATCH", status: 200 }
    case "delete":
      return { method: "DELETE", status: 204 }
    case "batchDelete":
      return {
        method: "POST",
        status: 204,
        customMethod: id,
      }
    default:
      return {
        method: "POST",
        status: 200,
        customMethod: id,
      }
  }
}

/** HTTP owns only route naming, field placement, serialization, and success status. */
export function httpOperation(
  operation: OperationContract,
  basePath: `/${string}` = "/api/v1"
): HttpOperation {
  const { id, object, linkTraversal, scope } = operation
  const { method, status, customMethod } = httpConvention(operation)
  const collection =
    `${basePath}/${object?.collection ?? (operation.builtin ? "records" : "")}` as const
  const resource =
    scope === "record" ? (`${collection}/:id` as const) : collection
  const path = linkTraversal
    ? (`${resource}/${linkTraversal.traversal.key}` as const)
    : resource
  const identifier = operation.builtin ?? operation.key
  const pathFields = scope === "record" ? ["id"] : []
  const fields = Object.fromEntries(
    Object.entries(operation.input.fields).filter(
      ([key]) => !pathFields.includes(key)
    )
  )
  const inputLocation =
    method === "GET" || method === "DELETE" ? "query" : "payload"
  // Structured list expressions use JSON only in URL parameters; MCP and domain inputs stay structured.
  if (inputLocation === "query") {
    for (const key of ["filter", "sort", "expand"]) {
      if (fields[key] !== undefined)
        fields[key] = Schema.optionalKey(Schema.fromJsonString(fields[key]))
    }
  }
  return {
    operation,
    group: object?.id ?? (operation.builtin ? "records" : "$global"),
    identifier,
    method,
    path: customMethod === undefined ? path : `${path}:${customMethod}`,
    params: Schema.Struct(
      Object.fromEntries(
        pathFields.map((key) => [key, operation.input.fields[key]!])
      )
    ),
    input:
      pathFields.length === 0 && inputLocation === "payload"
        ? operation.input
        : Schema.Struct(fields).annotate({
            identifier: `${pascalCase(object?.id ?? "")}${linkTraversal ? pascalCase(linkTraversal.traversal.key) : ""}${pascalCase(id)}Input`,
          }),
    inputLocation,
    status,
  }
}

/** Packages canonical arguments for Effect's generated HTTP client. */
export function httpOperationRequest(
  http: HttpOperation,
  input: Readonly<Record<string, unknown>>
) {
  const pathFields = Object.keys(http.params.fields)
  const params = Object.fromEntries(pathFields.map((key) => [key, input[key]]))
  return {
    params,
    [http.inputLocation]: Object.fromEntries(
      Object.entries(input).filter(([key]) => !pathFields.includes(key))
    ),
  }
}

/** Reassembles canonical arguments from the decoded HTTP request. */
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
    ...request.params,
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
  for (const operation of operationContracts(model)) {
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
