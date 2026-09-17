import { createHash } from "node:crypto"

import { Effect, Schema } from "effect"

import { createRecordSearchContract } from "#/runtime/contract/record-search.ts"
import { normalizePageSize } from "#/runtime/model/definition/request.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { PageTokens } from "#/runtime/server/page-tokens.ts"
import { searchSnippets } from "#/runtime/server/search-snippets.ts"
import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"
import {
  decodeCursor,
  encodeCursor,
} from "#/runtime/server/storage/object-query.ts"
import { searchVector } from "#/runtime/server/storage/search-index.ts"
import { SqlDatabase } from "#/runtime/server/storage/transactions.ts"

export function createRecordSearch(model: ModelCatalog) {
  const {
    input: recordSearchInput,
    result: recordSearchResult,
    searchableObjects,
  } = createRecordSearchContract(model)
  /** One search index, with active object types selected before ranking and limits. */
  return Effect.fn("@company/records.search")(function* (
    input: typeof recordSearchInput.Type
  ) {
    yield* requireProjectAccess
    const request = yield* Schema.decodeUnknownEffect(recordSearchInput)(input)
    const objectTypes = searchableObjects
      .filter(
        (object) =>
          request.objectTypes === undefined ||
          request.objectTypes.includes(object.id)
      )
      .map((object) => object.id)
      .sort()
    const limit = normalizePageSize(request.pageSize)
    const tokens = yield* PageTokens
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          operation: "records.search",
          query: request.query,
          objects: objectTypes,
        })
      )
      .digest("hex")
    const cursor = request.pageToken
      ? yield* Effect.try({
          try: () =>
            decodeCursor(
              { id: "records.search" },
              tokens,
              request.pageToken!,
              fingerprint,
              3
            ),
          catch: (error) => error,
        })
      : undefined
    if (request.query.trim().length === 0 || objectTypes.length === 0)
      return { items: [], nextPageToken: null, totalSize: 0 }
    const objects = (yield* ModelContext).storage.core.objects
    const { sql } = yield* SqlDatabase
    const visible = objectTypes.map(
      (id) => sql`${objects.columns.objectType} = ${id}`
    )
    const after = cursor
      ? sql`(rank < ${cursor.values[0]}::real or (rank = ${cursor.values[0]}::real and (title, id) > (${cursor.values[1]}, ${cursor.values[2]})))`
      : sql`true`
    // Count and rank the same visible matches; the total excludes the cursor boundary.
    const matches = sql`
      from ${recordSearch}
      join ${objects} on ${objects.columns.id} = ${recordSearch.columns.id}
      cross join (
        select to_tsquery('simple', coalesce(string_agg(quote_literal(lexeme) || ':*', ' & '), '')) as query
        from unnest(tsvector_to_array(${searchVector(sql, sql`${request.query}`)})) as lexeme
      ) q
      where ${recordSearch.columns.document} @@ q.query and (${sql.join(" OR ")(visible)})`
    const [total] = yield* sql<{
      totalSize: number
    }>`select count(*)::double precision as "totalSize" ${matches}`
    const rows = yield* sql<{
      id: string
      objectType: string
      title: string
      subtitle: string | null
      image: unknown
      status: string | null
      rank: number
      query: string
    }>`
    with ranked as (
    select ${recordSearch.columns.id} as id, ${objects.columns.objectType} as "objectType",
      ${recordSearch.columns.title} as title, ${recordSearch.columns.subtitle} as subtitle,
      ${recordSearch.columns.image} as image, ${recordSearch.columns.status} as status,
      ts_rank(${recordSearch.columns.document}, q.query) as rank, q.query::text as query
      ${matches}
    )
    select * from ranked where ${after}
    order by rank desc, title, id
    limit ${limit + 1}
  `
    const page = rows.slice(0, limit)
    const snippets = yield* searchSnippets(model, page, page[0]?.query ?? "")
    const last = page.at(-1)
    return yield* Schema.decodeUnknownEffect(recordSearchResult)({
      totalSize: total!.totalSize,
      items: page.map(({ rank: _rank, query: _query, ...hit }) => ({
        ...hit,
        snippets: snippets.get(hit.id) ?? [],
      })),
      nextPageToken:
        rows.length > limit && last
          ? encodeCursor(tokens, {
              version: 1,
              fingerprint,
              values: [last.rank, last.title, last.id],
            })
          : null,
    })
  })
}
