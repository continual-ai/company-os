import type { QueryClient } from "@tanstack/react-query"
import { Schema } from "effect"

import {
  cacheGeneration,
  changedModelQueries,
  resetModelCache,
  invalidateModelQueries,
} from "#/runtime/client/data-client.ts"
import type { EventPage } from "#/runtime/client/events.ts"
import { toEffectObjectSchema } from "#/runtime/contract/schema.ts"
import type { ModelCatalog } from "#/runtime/model/index.ts"

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

/** The application repository issues monotonically increasing numeric etags. */
export function isNewerOrEqualRecord(
  incoming: { readonly etag: string },
  current: { readonly etag: string }
) {
  return BigInt(incoming.etag) >= BigInt(current.etag)
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
    if (!previous || isNewerOrEqualRecord(change.record, previous.record))
      latest.set(change.record.id, change)
  }
  const patch = (value: unknown): unknown => {
    if (!isSnapshot(value)) return value
    const change = latest.get(value.id)
    return change && isNewerOrEqualRecord(change.record, value)
      ? change.deleted
        ? undefined
        : { ...value, ...change.record }
      : value
  }
  const patchPage = (value: unknown): unknown => {
    if (
      typeof value !== "object" ||
      value === null ||
      !("items" in value) ||
      !Array.isArray(value.items)
    )
      return value
    return {
      ...value,
      items: value.items.map(patch).filter((item) => item !== undefined),
    }
  }
  for (const query of cache.getQueryCache().findAll(affected)) {
    if (query.meta?.custom === true) continue
    const value = query.state.data
    if (isSnapshot(value)) {
      const updated = patch(value)
      if (updated === undefined) query.reset()
      else if (updated !== value) cache.setQueryData(query.queryKey, updated)
    } else if (
      query.meta?.paginated === true &&
      typeof value === "object" &&
      value !== null &&
      "pages" in value &&
      Array.isArray(value.pages)
    ) {
      cache.setQueryData(query.queryKey, {
        ...value,
        pages: value.pages.map(patchPage),
      })
    } else {
      const updated = patchPage(value)
      if (updated !== value) cache.setQueryData(query.queryKey, updated)
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

export async function applyEventPage(
  cache: QueryClient,
  page: EventPage,
  Model: ModelCatalog
) {
  const currentRecords = new Map<string, (value: unknown) => boolean>(
    Object.values(Model.objects).map((object) => [
      object.id,
      Schema.is(toEffectObjectSchema(object)),
    ])
  )

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
    if (event.version !== 1 || !isSnapshot(event.data)) continue
    const snapshotData = event.data
    const target = event.subjects.find(
      (subject) => subject.id === snapshotData.id
    )
    if (target === undefined) continue
    const deleted = event.type === `${target.objectType}.deleted`
    const snapshot =
      event.type === `${target.objectType}.created` ||
      event.type === `${target.objectType}.updated`
    // Old schemas remain replayable but cannot introduce invalid records into today's UI.
    if (
      deleted ||
      (snapshot && currentRecords.get(target.objectType)?.(event.data))
    )
      changes.push({ record: event.data, deleted })
  }
  await applyModelChanges(cache, changes, [
    ...new Set(
      page.items.flatMap((event) =>
        event.subjects.map((subject) => subject.objectType)
      )
    ),
  ])
}
