import type { QueryClient } from "@tanstack/react-query"

import {
  cacheGeneration,
  changedModelQueries,
  resetModelCache,
  invalidateModelQueries,
} from "./data-client"
import type { EventPage } from "./events"

interface Snapshot {
  readonly id: string
  readonly etag: string
  readonly [key: string]: unknown
}
interface Change {
  readonly record: Snapshot
  readonly deleted?: boolean
}

function isSnapshot(value: unknown): value is Snapshot {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "etag" in value &&
    typeof value.etag === "string"
  )
}

function newerOrEqual(incoming: Snapshot, current: Snapshot) {
  return /^\d+$/.test(incoming.etag) && /^\d+$/.test(current.etag)
    ? BigInt(incoming.etag) >= BigInt(current.etag)
    : incoming.etag === current.etag
}

/** Replace appearances, never infer filtered membership, ordering, totals, or aggregate results. */
export async function applyModelChanges(
  cache: QueryClient,
  changes: ReadonlyArray<Change>,
  types: ReadonlyArray<string>
) {
  if (types.length === 0) return
  const generation = cacheGeneration(cache)
  const affected = changedModelQueries(types)
  // Cancel first: a read started before this commit must not overwrite its snapshot.
  await cache.cancelQueries(affected, { revert: false })
  if (cacheGeneration(cache) !== generation) return
  const latest = new Map<string, Change>()
  for (const change of changes) {
    const previous = latest.get(change.record.id)
    if (!previous || newerOrEqual(change.record, previous.record))
      latest.set(change.record.id, change)
  }
  const patch = (value: unknown): unknown => {
    if (!isSnapshot(value)) return value
    const change = latest.get(value.id)
    return change && newerOrEqual(change.record, value)
      ? change.deleted
        ? undefined
        : { ...value, ...change.record }
      : value
  }
  for (const query of cache.getQueryCache().findAll(affected)) {
    if (query.meta?.custom === true) continue
    const value = query.state.data
    if (isSnapshot(value)) {
      const updated = patch(value)
      if (updated === undefined) query.reset()
      else if (updated !== value) cache.setQueryData(query.queryKey, updated)
    } else if (
      typeof value === "object" &&
      value !== null &&
      "items" in value &&
      Array.isArray(value.items)
    ) {
      cache.setQueryData(query.queryKey, {
        ...value,
        items: value.items.map(patch).filter((item) => item !== undefined),
      })
    }
  }
  invalidateModelQueries(cache, types)
}

/** Standard actions return canonical records; custom actions report their actual writes in HTTP headers. */
export function applyMutationResult(
  cache: QueryClient,
  operation: string,
  result: unknown,
  types: ReadonlyArray<string>
) {
  return applyModelChanges(
    cache,
    (operation === "create" || operation === "update") && isSnapshot(result)
      ? [{ record: result }]
      : [],
    types
  )
}

export async function applyEventPage(cache: QueryClient, page: EventPage) {
  if (page.reset) {
    const generation = cacheGeneration(cache)
    await cache.cancelQueries()
    if (cacheGeneration(cache) !== generation) return
    // Reset also drops records whose access was revoked; invalidation alone would leave them visible.
    resetModelCache(cache)
    return
  }
  const changes: Change[] = []
  for (const event of page.items) {
    if (event.version === 2 && isSnapshot(event.data))
      changes.push({
        record: event.data,
        deleted: event.type.endsWith(".deleted"),
      })
  }
  await applyModelChanges(cache, changes, [
    ...new Set(
      page.items.flatMap((event) =>
        event.subjects.map((subject) => subject.objectType)
      )
    ),
  ])
}
