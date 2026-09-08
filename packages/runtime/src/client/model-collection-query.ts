import { infiniteQueryOptions } from "@tanstack/react-query"

import type { ModelQueryOptions } from "#/client/model-query-client.ts"
import type { ListRequest, Page, PageToken } from "#/model/index.ts"

/** Collections share one cursor chain; refreshes rebuild it in order using current server cursors. */
export function modelCollectionQuery<A>(
  list: (request: ListRequest) => ModelQueryOptions<Page<A>>,
  request: Omit<ListRequest, "pageToken">
) {
  const first = list(request)
  return infiniteQueryOptions({
    queryKey: [...first.queryKey, "pages"],
    meta: { ...first.meta, paginated: true },
    initialPageParam: undefined as PageToken | undefined,
    queryFn: ({ pageParam, signal }) =>
      list({
        ...request,
        ...(pageParam === undefined ? {} : { pageToken: pageParam }),
      }).queryFn({ signal }),
    getNextPageParam: (page) => page.nextPageToken ?? undefined,
  })
}
