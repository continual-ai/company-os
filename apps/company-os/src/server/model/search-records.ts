import { sql } from "drizzle-orm"
import { Effect, Schema } from "effect"

import {
  recordSearchInput,
  recordSearchResult,
  searchableObjects,
  type RecordSearchInput,
} from "@/records"
import { Authorization } from "@/server/authorization/authorization-service"
import { Database } from "@/server/database/database"
import { objects, recordSearch } from "@/server/database/schema"
import { searchVector } from "@/server/database/search-index"

/** One search index, with current row visibility applied before ranking and limits. */
export const searchRecords = Effect.fn("@company/records.search")(function* (
  input: RecordSearchInput
) {
  const request = yield* Schema.decodeUnknownEffect(recordSearchInput)(input)
  if (request.query.trim().length === 0) return { hits: [], hasMore: false }
  const database = yield* Database
  const authorization = yield* Authorization
  const scopes = yield* authorization.readableScopes()
  const visible = Object.entries(scopes)
    .filter(
      ([type, ids]) =>
        ids.length > 0 &&
        searchableObjects.some((object) => object.id === type) &&
        (request.objectTypes === undefined ||
          request.objectTypes.some((id) => id === type))
    )
    .map(([type, ids]) => {
      const scopeIds = sql`array[${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `
      )}]::text[]`
      return sql`(${objects.objectType} = ${type} and (${objects.id} = any(${scopeIds}) or ${objects.ancestorIds} && ${scopeIds}))`
    })
  if (visible.length === 0) return { hits: [], hasMore: false }
  const limit = request.limit ?? 20
  // The same PostgreSQL parser handles indexed text and user input. Escaping lexemes
  // prevents punctuation from becoming tsquery operators; all word prefixes must match.
  const rows = yield* database.execute(
    sql`
    with search_query as (
      select to_tsquery('simple', coalesce(string_agg(quote_literal(lexeme) || ':*', ' & '), '')) as query
      from unnest(tsvector_to_array(${searchVector(sql`${request.query}`)})) as lexeme
    )
    select ${recordSearch.id} as id, ${objects.objectType} as "objectType",
      ${recordSearch.title} as title, ${recordSearch.subtitle} as subtitle,
      ${recordSearch.image} as image, ${recordSearch.status} as status
    from ${recordSearch}
    join ${objects} on ${objects.id} = ${recordSearch.id}
    cross join search_query q
    where ${recordSearch.document} @@ q.query and (${sql.join(visible, sql` or `)})
    order by ts_rank(${recordSearch.document}, q.query) desc, ${recordSearch.title}, ${recordSearch.id}
    limit ${limit + 1}
  `,
    "objects"
  )
  return yield* Schema.decodeUnknownEffect(recordSearchResult)({
    hits: rows.slice(0, limit),
    hasMore: rows.length > limit,
  })
})
