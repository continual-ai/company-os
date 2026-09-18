import { Schema } from "effect"

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  PageToken,
} from "#/runtime/model/definition/request.ts"

const pageTokenSchema = Schema.String.pipe(
  Schema.fromBrand("PageToken", PageToken)
)
const totalSizeSchema = Schema.Number.check(
  Schema.isInt(),
  Schema.isGreaterThanOrEqualTo(0)
).annotate({
  description:
    "Number of matching items before pagination; a lower bound when totalSizeExact is false.",
  identifier: "TotalSize",
})
export const totalSizeFields = {
  totalSize: totalSizeSchema,
  totalSizeExact: Schema.Boolean.annotate({
    description:
      "True means exact; false means at least totalSize, never an estimate.",
  }),
}
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
  pageOffset: Schema.optionalKey(
    Schema.Number.check(
      Schema.isInt(),
      Schema.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER })
    ).annotate({
      description:
        "Zero-based row position for direct access. Cannot be combined with pageToken.",
    })
  ),
  pageToken: Schema.optionalKey(pageTokenSchema),
}

export function pageSchema<S extends Schema.Top>(item: S) {
  return Schema.Struct({
    items: Schema.Array(item),
    nextPageToken: Schema.NullOr(pageTokenSchema).annotate({
      identifier: "PageContinuation",
    }),
    ...totalSizeFields,
  })
}
