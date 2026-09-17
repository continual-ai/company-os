import { Schema } from "effect"

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PageToken,
} from "#/runtime/model/definition/request.ts"

const pageTokenSchema = Schema.String.pipe(
  Schema.fromBrand("PageToken", PageToken)
)
const pageTotalSizeSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
).annotate({
  description:
    "Exact number of matching items visible to the caller before pagination.",
  identifier: "PageTotalSize",
})
const pageSizeSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
).annotate({
  default: DEFAULT_PAGE_SIZE,
  description: `Maximum number of records to return. Zero uses the default of ${DEFAULT_PAGE_SIZE}; values above ${MAX_PAGE_SIZE} are capped.`,
  identifier: "PageSize",
})

export const paginationInputFields = {
  pageSize: Schema.optionalKey(pageSizeSchema),
  pageToken: Schema.optionalKey(pageTokenSchema),
}

export function pageSchema<S extends Schema.Top>(item: S) {
  return Schema.Struct({
    items: Schema.Array(item),
    nextPageToken: Schema.NullOr(pageTokenSchema).annotate({
      identifier: "PageContinuation",
    }),
    totalSize: pageTotalSizeSchema,
  })
}
