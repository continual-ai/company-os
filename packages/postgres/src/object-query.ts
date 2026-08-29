import { createHash } from "node:crypto"

import {
  RecordId,
  Timestamp,
  type ObjectRecord,
  type ObjectSort,
  type ObjectType,
  type PageToken,
  type PageTokenCodec,
} from "@company/runtime"
import { toEffectInputSchema } from "@company/runtime/effect"
import {
  InvalidListRequest,
  type RepositoryFilter,
  type RepositoryListRequest,
} from "@company/runtime/effect/object-repository"
import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  not,
  or,
  sql,
  type Column,
  type SQL,
} from "drizzle-orm"
import { Schema } from "effect"

export type QueryValue = boolean | null | number | string

export interface CursorPayload {
  readonly fingerprint: string
  readonly values: ReadonlyArray<QueryValue>
  readonly version: 1
}

export interface CursorSort {
  readonly direction: "asc" | "desc"
  readonly field: string
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

export function invalidListRequest(object: ObjectType, message: string) {
  return new InvalidListRequest({ message, objectType: object.id })
}

export function orderExpression(sort: ResolvedSort): SQL {
  const ordered =
    sort.direction === "asc" ? asc(sort.column) : desc(sort.column)
  return sort.nulls === "first"
    ? sql`${ordered} nulls first`
    : sql`${ordered} nulls last`
}

function equalCursorValue(sort: ResolvedSort, value: QueryValue): SQL {
  return value === null ? isNull(sort.column) : eq(sort.column, value)
}

function laterCursorValue(
  sort: ResolvedSort,
  value: QueryValue
): SQL | undefined {
  if (value === null) {
    return sort.nulls === "first" ? isNotNull(sort.column) : undefined
  }
  const comparison =
    sort.direction === "asc" ? gt(sort.column, value) : lt(sort.column, value)
  return sort.nulls === "last"
    ? or(comparison, isNull(sort.column))
    : comparison
}

export function cursorCondition(
  sort: ReadonlyArray<ResolvedSort>,
  values: ReadonlyArray<QueryValue>,
  index = 0
): SQL | undefined {
  const current = sort[index]
  const value = values[index]
  if (current === undefined || value === undefined) return undefined
  const later = laterCursorValue(current, value)
  const tied = cursorCondition(sort, values, index + 1)
  const tiedAndLater =
    tied === undefined ? undefined : and(equalCursorValue(current, value), tied)
  return or(later, tiedAndLater)
}

export function recordValue<TObject extends ObjectType>(
  record: ObjectRecord<TObject>,
  field: string
): QueryValue {
  const value = Object.entries(record).find(([key]) => key === field)?.[1]
  return Schema.decodeUnknownSync(queryValueSchema)(value)
}

function cursorFilter<TObject extends ObjectType>(
  filter: RepositoryFilter<TObject>
): unknown {
  if ("and" in filter) return ["and", filter.and.map(cursorFilter)]
  if ("not" in filter) return ["not", cursorFilter(filter.not)]
  if ("or" in filter) return ["or", filter.or.map(cursorFilter)]
  return "value" in filter
    ? [filter.field, filter.operator, filter.value]
    : [filter.field, filter.operator]
}

export function cursorFingerprint<TObject extends ObjectType>(
  object: TObject,
  request: RepositoryListRequest<TObject>,
  sort: ReadonlyArray<CursorSort>
): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        filter:
          request.filter === undefined ? null : cursorFilter(request.filter),
        objectType: object.id,
        sort: sort.map(({ direction, field, nulls }) => [
          field,
          direction,
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
  object: ObjectType,
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

export function makeObjectQueryCompiler<TObject extends ObjectType>(
  object: TObject,
  queryColumns: Readonly<Record<string, Column>>
) {
  const columnFor = (field: string): Column => {
    const column = queryColumns[field]
    if (column === undefined) {
      throw invalidListRequest(
        object,
        `Field '${field}' cannot be filtered or sorted.`
      )
    }
    return column
  }

  const allowedOperators = (field: string): ReadonlySet<string> => {
    if (field === "id" || field === "parent") return new Set(["eq", "in"])
    if (field === "createdBy" || field === "updatedBy") {
      return new Set(["eq", "in"])
    }
    if (field === "systemManaged") return new Set(["eq", "in"])
    if (field === "createdAt" || field === "updatedAt") {
      return new Set(["eq", "gt", "gte", "in", "lt", "lte"])
    }

    const property = object.properties[field]
    if (property === undefined) return new Set()
    const nullable = property.nullable ? ["isNull"] : []
    switch (property.kind) {
      case "boolean":
      case "enum":
      case "recordId":
        return new Set(["eq", "in", ...nullable])
      case "decimal":
      case "number":
        return new Set(["eq", "gt", "gte", "in", "lt", "lte", ...nullable])
      case "string":
        return property.format === "date" || property.format === "timestamp"
          ? new Set(["eq", "gt", "gte", "in", "lt", "lte", ...nullable])
          : new Set([
              "contains",
              "endsWith",
              "eq",
              "in",
              "startsWith",
              ...nullable,
            ])
      default:
        return new Set()
    }
  }

  const decodeFilterValue = (
    field: string,
    value: QueryValue
  ): Exclude<QueryValue, null> => {
    if (value === null || value === undefined) {
      throw invalidListRequest(
        object,
        `Filter property '${field}' requires a non-null value.`
      )
    }
    const property = object.properties[field]
    if (property !== undefined) {
      const decoded = Schema.decodeUnknownSync(toEffectInputSchema(property))(
        value
      )
      const queryValue = Schema.decodeUnknownSync(queryValueSchema)(decoded)
      if (queryValue === null) {
        throw invalidListRequest(
          object,
          `Filter property '${field}' requires a non-null value.`
        )
      }
      return queryValue
    }
    if (field === "systemManaged") {
      return Schema.decodeUnknownSync(Schema.Boolean)(value)
    }
    const textValue = Schema.decodeUnknownSync(Schema.String)(value)
    if (field === "id" || field === "parent") {
      if (textValue.length === 0) {
        throw invalidListRequest(
          object,
          `Filter property '${field}' requires a non-empty record ID.`
        )
      }
      return textValue
    }
    if (field === "createdBy" || field === "updatedBy") {
      return RecordId("actor")(textValue)
    }
    if (field === "createdAt" || field === "updatedAt") {
      return Timestamp(textValue)
    }
    throw invalidListRequest(object, `Unknown filter property '${field}'.`)
  }

  const decodeStringFilterValue = (field: string, value: string): string =>
    Schema.decodeUnknownSync(Schema.String)(decodeFilterValue(field, value))

  const compileFilter = (filter: RepositoryFilter<TObject>): SQL => {
    if ("and" in filter) {
      if (filter.and.length === 0) {
        throw invalidListRequest(object, "An 'and' filter cannot be empty.")
      }
      return and(...filter.and.map(compileFilter))!
    }
    if ("or" in filter) {
      if (filter.or.length === 0) {
        throw invalidListRequest(object, "An 'or' filter cannot be empty.")
      }
      return or(...filter.or.map(compileFilter))!
    }
    if ("not" in filter) return not(compileFilter(filter.not))!

    const column = columnFor(filter.field)
    if (!allowedOperators(filter.field).has(filter.operator)) {
      throw invalidListRequest(
        object,
        `Operator '${filter.operator}' is not supported for property '${filter.field}'.`
      )
    }

    switch (filter.operator) {
      case "contains": {
        const value = decodeStringFilterValue(filter.field, filter.value)
        return ilike(column, `%${escapeLike(value)}%`)
      }
      case "endsWith": {
        const value = decodeStringFilterValue(filter.field, filter.value)
        return ilike(column, `%${escapeLike(value)}`)
      }
      case "eq":
        return eq(
          column,
          decodeFilterValue(
            filter.field,
            Schema.decodeUnknownSync(queryValueSchema)(filter.value)
          )
        )
      case "gt":
        return gt(
          column,
          decodeFilterValue(
            filter.field,
            Schema.decodeUnknownSync(queryValueSchema)(filter.value)
          )
        )
      case "gte":
        return gte(
          column,
          decodeFilterValue(
            filter.field,
            Schema.decodeUnknownSync(queryValueSchema)(filter.value)
          )
        )
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
        return values.length === 0 ? sql`false` : inArray(column, values)
      }
      case "isNull":
        return isNull(column)
      case "lt":
        return lt(
          column,
          decodeFilterValue(
            filter.field,
            Schema.decodeUnknownSync(queryValueSchema)(filter.value)
          )
        )
      case "lte":
        return lte(
          column,
          decodeFilterValue(
            filter.field,
            Schema.decodeUnknownSync(queryValueSchema)(filter.value)
          )
        )
      case "startsWith": {
        const value = decodeStringFilterValue(filter.field, filter.value)
        return ilike(column, `${escapeLike(value)}%`)
      }
    }
    throw invalidListRequest(object, "The filter operator is invalid.")
  }

  const resolveSort = (
    request: RepositoryListRequest<TObject>
  ): ReadonlyArray<ResolvedSort> => {
    const requested: Array<ObjectSort<TObject>> = [...(request.sort ?? [])]
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
        !new Set([
          "boolean",
          "decimal",
          "enum",
          "number",
          "recordId",
          "string",
        ]).has(property.kind)
      ) {
        throw invalidListRequest(
          object,
          `Property '${sort.field}' cannot be sorted.`
        )
      }
      return {
        ...sort,
        column: columnFor(sort.field),
        nulls: sort.nulls ?? "last",
      }
    })
  }

  return { compileFilter, resolveSort }
}
