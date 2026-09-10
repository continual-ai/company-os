import { Effect, Schema } from "effect"

import { createRecordSearchContract } from "#/runtime/contract/record-search.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"
import { requireProjectAccess } from "#/runtime/server/auth/project-access.ts"
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
  /** One search index, with active object types selected before ranking and limits. */
  return Effect.fn("@company/records.search")(function* (
    input: typeof recordSearchInput.Type
  ) {
    yield* requireProjectAccess
    const request = yield* Schema.decodeUnknownEffect(recordSearchInput)(input)
    if (request.query.trim().length === 0) return { hits: [], hasMore: false }
    const objects = (yield* ModelContext).storage.core.objects
    const database = yield* Database
    const sql = database.sql
    const visible = searchableObjects
      .filter(
        (object) =>
          request.objectTypes === undefined ||
          request.objectTypes.some((id) => id === object.id)
      )
      .map((object) => sql`${objects.columns.objectType} = ${object.id}`)
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
