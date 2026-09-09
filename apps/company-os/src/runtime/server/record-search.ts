import { Effect, Schema } from "effect"

import { createRecordSearchContract } from "#/runtime/client/record-search.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { Authorization } from "#/runtime/server/authorization/authorization-service.ts"
import { ModelContext } from "#/runtime/server/model-context.ts"
import { Database } from "#/runtime/server/storage/database.ts"
import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"
import { searchVector } from "#/runtime/server/storage/search-index.ts"

export function createRecordSearch(model: ModelCatalog) {
  const {
    input: recordSearchInput,
    result: recordSearchResult,
    searchableObjects,
  } = createRecordSearchContract(model)
  /** One search index, with current row visibility applied before ranking and limits. */
  return Effect.fn("@company/records.search")(function* (
    input: typeof recordSearchInput.Type
  ) {
    const request = yield* Schema.decodeUnknownEffect(recordSearchInput)(input)
    if (request.query.trim().length === 0) return { hits: [], hasMore: false }
    const objects = (yield* ModelContext).storage.core.objects
    const database = yield* Database
    const sql = database.sql
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
        const scopeIds = sql`array[${sql.join(", ", false)(ids.map((id) => sql`${id}`))}]::text[]`
        return sql`(${objects.columns.objectType} = ${type} and (${objects.columns.id} = any(${scopeIds}) or ${objects.columns.ancestorIds} && ${scopeIds}))`
      })
    if (visible.length === 0) return { hits: [], hasMore: false }
    const limit = request.limit ?? 20
    // The same PostgreSQL parser handles indexed text and user input. Escaping lexemes
    // prevents punctuation from becoming tsquery operators; all word prefixes must match.
    const rows = yield* sql`
    with search_query as (
      select to_tsquery('simple', coalesce(string_agg(quote_literal(lexeme) || ':*', ' & '), '')) as query

          from unnest(tsvector_to_array(${searchVector(sql, sql`${request.query}`)})) as lexeme
    )
    select ${recordSearch.columns.id} as id, ${objects.columns.objectType} as "objectType",
      ${recordSearch.columns.title} as title, ${recordSearch.columns.subtitle} as subtitle,
      ${recordSearch.columns.image} as image, ${recordSearch.columns.status} as status

          from ${recordSearch}
    join ${objects} on ${objects.columns.id} = ${recordSearch.columns.id}
    cross join search_query q

          where ${recordSearch.columns.document} @@ q.query and (${sql.join(" OR ")(visible)})

          order by ts_rank(${recordSearch.columns.document}, q.query) desc, ${recordSearch.columns.title}, ${recordSearch.columns.id}

          limit ${limit + 1}
  `
    return yield* Schema.decodeUnknownEffect(recordSearchResult)({
      hits: rows.slice(0, limit),
      hasMore: rows.length > limit,
    })
  })
}
