import type { Constructor, Fragment } from "effect/unstable/sql/Statement"

import { recordSearch } from "#/runtime/server/storage/infrastructure.ts"

/** Indexing and queries share tokenization for email domains, URLs, hyphens, and names. */
export function searchVector(sql: Constructor, text: Fragment) {
  return sql`to_tsvector('simple', regexp_replace(coalesce(${text}, ''), '[^[:alnum:]_]+', ' ', 'g'))`
}

export function searchQuery(sql: Constructor, query: string) {
  return sql`(select to_tsquery('simple', coalesce(string_agg(quote_literal(lexeme) || ':*', ' & '), ''))
    from unnest(tsvector_to_array(${searchVector(sql, sql`${query}`)})) as lexeme)`
}

/** Keep list ordering and pagination while using the same index as global search. */
export function searchMatch(sql: Constructor, id: Fragment, query?: string) {
  return query?.trim()
    ? sql`${id} in (select ${recordSearch.columns.id} from ${recordSearch} where ${recordSearch.columns.document} @@ ${searchQuery(sql, query)})`
    : undefined
}
