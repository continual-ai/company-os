import { createHash } from "node:crypto"

import { Schema } from "effect"
import type { Constructor, Fragment } from "effect/unstable/sql/Statement"

import { decodeQueryValue } from "#/runtime/contract/query-validation.ts"
import type { LinkFilter } from "#/runtime/model/definition/request.ts"
import { containsSecret } from "#/runtime/model/definition/schema.ts"
import {
  type ObjectSort,
  type ObjectType,
  type PageToken,
  type PageTokenCodec,
} from "#/runtime/model/index.ts"
import {
  queryProperty,
  fieldOperators,
  type QueryType,
} from "#/runtime/model/query-fields.ts"
import { InvalidListRequest } from "#/runtime/server/errors.ts"
import {
  type RepositoryFilter,
  type RepositoryListRequest,
} from "#/runtime/server/storage/object-repository.ts"
import type { QueryField } from "#/runtime/server/storage/relational-query.ts"
import { inValues } from "#/runtime/server/storage/statement.ts"
import { type Column } from "#/runtime/server/storage/table.ts"

export type QueryFilter =
  | LinkFilter
  | {
      readonly field: string
      readonly operator: string
      readonly value?: unknown
    }
  | { readonly and: ReadonlyArray<QueryFilter> }
  | { readonly or: ReadonlyArray<QueryFilter> }
  | { readonly not: QueryFilter }

export type QueryValue = boolean | null | number | string

export interface CursorPayload {
  readonly fingerprint: string
  readonly values: ReadonlyArray<QueryValue>
  readonly version: 1
}

export interface CursorSort {
  readonly direction: "asc" | "desc"
  readonly field: string
  readonly aggregate?: "count" | "min" | "max"
  readonly nulls?: "first" | "last"
}

export interface ResolvedSort {
  readonly column: Column
  readonly direction: "asc" | "desc"
  readonly field: string
  readonly nulls: "first" | "last"
}

const queryValueSchema = Schema.Union([
  Schema.Boolean,
  Schema.Null,
  Schema.Number,
  Schema.String,
])

const cursorPayloadSchema = Schema.Struct({
  fingerprint: Schema.String,
  values: Schema.Array(queryValueSchema),
  version: Schema.Literal(1),
})

export function invalidListRequest(
  object: { readonly id: string },
  message: string
) {
  return new InvalidListRequest({ message, objectType: object.id })
}

export function orderExpression(
  sql: Constructor,
  sort: ResolvedSort
): Fragment {
  const ordered =
    sort.direction === "asc"
      ? sql`${sort.column} asc`
      : sql`${sort.column} desc`
  return sort.nulls === "first"
    ? sql`${ordered} nulls first`
    : sql`${ordered} nulls last`
}

function equalCursorValue(
  sql: Constructor,
  sort: ResolvedSort,
  value: QueryValue
): Fragment {
  return value === null
    ? sql`${sort.column} is null`
    : sql`${sort.column} = ${value}`
}

function laterCursorValue(
  sql: Constructor,
  sort: ResolvedSort,
  value: QueryValue
): Fragment | undefined {
  if (value === null) {
    return sort.nulls === "first" ? sql`${sort.column} is not null` : undefined
  }
  const comparison =
    sort.direction === "asc"
      ? sql`${sort.column} > ${value}`
      : sql`${sort.column} < ${value}`
  return sort.nulls === "last"
    ? sql`(${comparison} or ${sort.column} is null)`
    : comparison
}

export function cursorCondition(
  sql: Constructor,
  sort: ReadonlyArray<ResolvedSort>,
  values: ReadonlyArray<QueryValue>,
  index = 0
): Fragment | undefined {
  const current = sort[index]
  const value = values[index]
  if (current === undefined || value === undefined) return undefined
  const later = laterCursorValue(sql, current, value)
  const tied = cursorCondition(sql, sort, values, index + 1)
  const tiedAndLater =
    tied === undefined
      ? undefined
      : sql`(${equalCursorValue(sql, current, value)} and ${tied})`
  return sql.join(
    " OR ",
    true,
    "false"
  )([later, tiedAndLater].filter((part) => part !== undefined))
}

function cursorFilter<TObject extends ObjectType>(
  filter: RepositoryFilter<TObject>
): unknown {
  if ("link" in filter) return filter
  if ("and" in filter) return ["and", filter.and.map(cursorFilter)]
  if ("not" in filter) return ["not", cursorFilter(filter.not)]
  if ("or" in filter) return ["or", filter.or.map(cursorFilter)]
  return "value" in filter
    ? [filter.field, filter.operator, filter.value]
    : [filter.field, filter.operator]
}

export function cursorFingerprint<TObject extends ObjectType>(
  object: { readonly id: string },
  request: RepositoryListRequest<TObject>,
  sort: ReadonlyArray<CursorSort>
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        filter:
          request.filter === undefined ? null : cursorFilter(request.filter),
        objectType: object.id,
        query: request.query?.trim() || undefined,
        relatedTo: request.relatedTo,
        sort: sort.map(({ direction, field, nulls, aggregate }) => [
          field,
          direction,
          aggregate,
          nulls ?? "last",
        ]),
      })
    )
    .digest()
    .subarray(0, 16)
    .toString("base64url")
}

export function encodeCursor(
  pageTokens: PageTokenCodec,
  payload: CursorPayload
): PageToken {
  return pageTokens.encode(JSON.stringify(payload))
}

export function decodeCursor(
  object: { readonly id: string },
  pageTokens: PageTokenCodec,
  token: PageToken,
  fingerprint: string,
  valueCount: number
): CursorPayload {
  try {
    const parsed = Schema.decodeUnknownSync(cursorPayloadSchema)(
      JSON.parse(pageTokens.decode(token))
    )
    if (
      parsed.fingerprint !== fingerprint ||
      parsed.values.length !== valueCount
    ) {
      throw invalidListRequest(
        object,
        "The page token does not match this list request."
      )
    }
    return { version: 1, fingerprint, values: parsed.values }
  } catch (error) {
    if (error instanceof InvalidListRequest) throw error
    throw invalidListRequest(object, "The page token is invalid.")
  }
}

function escapeLike(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_")
}

export function makeObjectQueryCompiler(
  sql: Constructor,
  object: QueryType,
  queryColumns: Readonly<Record<string, Column>>,
  linkFilter?: (filter: LinkFilter) => Fragment,
  relatedField?: (
    field: string,
    aggregate?: "count" | "min" | "max"
  ) => QueryField
) {
  const columnFor = (field: string): Column => {
    const property = field.includes(".")
      ? relatedField?.(field).property
      : object.properties[field]
    if (property && containsSecret(property))
      throw invalidListRequest(
        object,
        `Field '${field}' cannot be filtered or sorted.`
      )
    const column =
      queryColumns[field] ??
      (field.includes(".") ? relatedField?.(field).column : undefined)
    if (column === undefined) {
      throw invalidListRequest(
        object,
        `Field '${field}' cannot be filtered or sorted.`
      )
    }
    return column
  }

  const propertyFor = (field: string) => {
    const property = field.includes(".")
      ? relatedField?.(field).property
      : queryProperty(object, field)
    if (!property)
      throw invalidListRequest(object, `Unknown filter property '${field}'.`)
    return property
  }

  const decodeFilterValue = (field: string, value: unknown, operator = "eq") =>
    decodeQueryValue(propertyFor(field), operator, value)

  const decodeStringFilterValue = (field: string, value: unknown): string =>
    Schema.decodeUnknownSync(Schema.String)(
      decodeFilterValue(field, value, "contains")
    )

  const compileFilter = (filter: QueryFilter): Fragment => {
    if ("and" in filter) {
      if (filter.and.length === 0) {
        throw invalidListRequest(object, "An 'and' filter cannot be empty.")
      }
      return sql.and(filter.and.map(compileFilter))
    }
    if ("or" in filter) {
      if (filter.or.length === 0) {
        throw invalidListRequest(object, "An 'or' filter cannot be empty.")
      }
      return sql.or(filter.or.map(compileFilter))
    }
    if ("not" in filter) return sql`not (${compileFilter(filter.not)})`

    if ("link" in filter) {
      if (!linkFilter)
        throw invalidListRequest(object, "Link filters are unavailable.")
      return linkFilter(filter)
    }
    const column = columnFor(filter.field)
    if (!fieldOperators(propertyFor(filter.field)).includes(filter.operator)) {
      throw invalidListRequest(
        object,
        `Operator '${filter.operator}' is not supported for property '${filter.field}'.`
      )
    }

    switch (filter.operator) {
      case "contains": {
        const value = decodeStringFilterValue(filter.field, filter.value)
        return sql`${column} ilike ${`%${escapeLike(value)}%`}`
      }
      case "endsWith": {
        const value = decodeStringFilterValue(filter.field, filter.value)
        return sql`${column} ilike ${`%${escapeLike(value)}`}`
      }
      case "eq":
        return sql`${column} = ${decodeFilterValue(
          filter.field,
          Schema.decodeUnknownSync(queryValueSchema)(filter.value)
        )}`
      case "gt":
        return sql`${column} > ${decodeFilterValue(
          filter.field,
          Schema.decodeUnknownSync(queryValueSchema)(filter.value)
        )}`
      case "gte":
        return sql`${column} >= ${decodeFilterValue(
          filter.field,
          Schema.decodeUnknownSync(queryValueSchema)(filter.value)
        )}`
      case "in": {
        if (!Array.isArray(filter.value)) {
          throw invalidListRequest(
            object,
            "Operator 'in' requires an array value."
          )
        }
        const values = filter.value.map((value) =>
          decodeFilterValue(
            filter.field,
            Schema.decodeUnknownSync(queryValueSchema)(value)
          )
        )
        return values.length === 0 ? sql`false` : inValues(sql, column, values)
      }
      case "isNull":
        return sql`${column} is null`
      case "lt":
        return sql`${column} < ${decodeFilterValue(
          filter.field,
          Schema.decodeUnknownSync(queryValueSchema)(filter.value)
        )}`
      case "lte":
        return sql`${column} <= ${decodeFilterValue(
          filter.field,
          Schema.decodeUnknownSync(queryValueSchema)(filter.value)
        )}`
      case "startsWith": {
        const value = decodeStringFilterValue(filter.field, filter.value)
        return sql`${column} ilike ${`${escapeLike(value)}%`}`
      }
    }
    throw invalidListRequest(object, "The filter operator is invalid.")
  }

  const resolveSort = <TObject extends ObjectType>(
    request: RepositoryListRequest<TObject>
  ): ReadonlyArray<ResolvedSort> => {
    const requested: Array<ObjectSort<TObject>> = request.sort?.length
      ? [...request.sort]
      : [
          { direction: "desc", field: "createdAt" },
          { direction: "desc", field: "id" },
        ]
    const duplicate = requested.find(
      (candidate, index) =>
        requested.findIndex(({ field }) => field === candidate.field) !== index
    )
    if (duplicate !== undefined) {
      throw invalidListRequest(
        object,
        `Sort property '${duplicate.field}' is declared more than once.`
      )
    }
    if (!requested.some(({ field }) => field === "id")) {
      requested.push({ direction: "asc", field: "id" })
    }
    return requested.map((sort) => {
      const property = object.properties[sort.field]
      if (
        property !== undefined &&
        (containsSecret(property) ||
          !new Set([
            "boolean",
            "decimal",
            "enum",
            "number",
            "recordId",
            "string",
          ]).has(property.kind))
      ) {
        throw invalidListRequest(
          object,
          `Property '${sort.field}' cannot be sorted.`
        )
      }
      return {
        ...sort,
        column:
          sort.aggregate === undefined
            ? columnFor(sort.field)
            : (relatedField?.(sort.field, sort.aggregate).column ??
              columnFor(sort.field)),
        nulls: sort.nulls ?? "last",
      }
    })
  }

  const boundedFilter = (filter: QueryFilter): Fragment => {
    let nodes = 0
    const visit = (value: unknown, depth = 0): void => {
      if (++nodes > 100 || depth > 20)
        throw invalidListRequest(object, "Filter exceeds the complexity limit.")
      if (value === null || typeof value !== "object") return
      for (const [key, child] of Object.entries(value)) {
        if (["and", "or"].includes(key) && Array.isArray(child))
          child.forEach((item) => visit(item, depth + 1))
        else if (["not", "some", "none", "every"].includes(key))
          visit(child, depth + 1)
      }
    }
    visit(filter)
    return compileFilter(filter)
  }
  return { compileFilter: boundedFilter, resolveSort }
}
