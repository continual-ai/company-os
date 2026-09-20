import type { Constructor, Fragment } from "effect/unstable/sql/Statement"

/** Counts are exact through this bound; larger collections report a guaranteed lower bound. */
export const COUNT_LIMIT = 1_000

export function countSummary(matches: number) {
  return {
    totalSize: Math.min(matches, COUNT_LIMIT),
    totalSizeExact: matches <= COUNT_LIMIT,
  }
}

/** The LIMIT belongs inside the aggregate so PostgreSQL can stop after the overflow witness. */
export function boundedCount(sql: Constructor, from: Fragment) {
  return sql`(select count(*)::integer from (select 1 ${from} limit ${COUNT_LIMIT + 1}) count_matches)`
}
