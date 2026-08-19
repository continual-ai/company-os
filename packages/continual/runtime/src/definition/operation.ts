export const DEFAULT_PAGE_SIZE = 50 as const
export const MAX_PAGE_SIZE = 100 as const
export const MAX_BATCH_GET_SIZE = 100 as const

/** Opaque token returned by one list call and supplied to the next. */
export type PageToken = string & { readonly _PageToken: true }

/** Client-generated key retained across retries of the same mutation. */
export type IdempotencyKey = string & { readonly _IdempotencyKey: true }

export interface ListRequest {
  readonly pageSize?: number
  readonly pageToken?: PageToken
}

export interface Page<TItem> {
  readonly items: ReadonlyArray<TItem>
  /** Empty when there is no next page. */
  readonly nextPageToken: PageToken | ""
}

export interface MutationOptions {
  readonly idempotencyKey?: IdempotencyKey
}
