import { Brand } from "effect"

export const DEFAULT_PAGE_SIZE = 50 as const
export const MAX_PAGE_SIZE = 100 as const
export const MAX_BATCH_GET_SIZE = 100 as const

/** Opaque token returned by one list call and supplied to the next. */
export type PageToken = string & Brand.Brand<"PageToken">
export const PageToken = Brand.make<PageToken>(
  (value) => value.length > 0 || "Expected a non-empty page token"
)

/** Client-generated key retained across retries of the same mutation. */
export type IdempotencyKey = string & Brand.Brand<"IdempotencyKey">
export const IdempotencyKey = Brand.make<IdempotencyKey>(
  (value) => value.length > 0 || "Expected a non-empty idempotency key"
)

export interface ListRequest {
  readonly pageSize?: number
  readonly pageToken?: PageToken
}

export interface Page<TItem> {
  readonly items: ReadonlyArray<TItem>
  /** Empty when there is no next page. */
  readonly nextPageToken: PageToken | ""
}

export interface Batch<TItem> {
  readonly items: ReadonlyArray<TItem>
}

export interface MutationOptions {
  readonly idempotencyKey?: IdempotencyKey
}
