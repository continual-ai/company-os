import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { modelCollectionQuery } from "#/runtime/client/model-collection-query.ts"
import type { ObjectType } from "#/runtime/model/index.ts"
import {
  calendarDay,
  collectionDateWindow,
} from "#/runtime/ui/model/collection-dates.ts"
import {
  type ObjectCollectionSearch,
  type ObjectCollectionView,
} from "#/runtime/ui/model/collection-view.ts"
import {
  clientFor,
  type ModelObject,
} from "#/runtime/ui/model/object-client.ts"
import { objectListRequest } from "#/runtime/ui/model/object-collection-query.ts"
import {
  emptyObjectCollectionViewState,
  resolveObjectCollectionView,
} from "#/runtime/ui/model/object-collection-view.ts"
import { type ModelUiRuntime } from "#/runtime/ui/model/runtime-context.tsx"

export function objectHref(
  runtime: ModelUiRuntime,
  object: ObjectType,
  recordId?: string
) {
  const base =
    runtime.ui[object.id]?.navigation?.path ?? `/objects/${object.id}`
  return recordId === undefined
    ? base
    : `${base}/${encodeURIComponent(recordId)}`
}
/** Hidden objects without a configured path have no pages; their records render as plain identities. */
function objectRouted(runtime: ModelUiRuntime, object: ObjectType) {
  const navigation = runtime.ui[object.id]?.navigation
  return navigation?.path !== undefined || navigation?.hidden !== true
}

export function objectRecordHref(
  runtime: ModelUiRuntime,
  object: ObjectType,
  recordId: string
) {
  return objectRouted(runtime, object)
    ? objectHref(runtime, object, recordId)
    : undefined
}

/** The object served under `/objects/<id>`; objects at a configured path or without pages are not found here. */
export function routeObject(runtime: ModelUiRuntime, id: string): ModelObject {
  const object = Object.values(runtime.model.objects).find(
    (candidate) => candidate.id === id
  )
  if (
    !object ||
    !objectRouted(runtime, object) ||
    runtime.ui[object.id]?.navigation?.path !== undefined
  )
    throw notFound()
  return object
}

/** The object whose configured navigation path is `path`, such as `/settings/users`. */
export function routeObjectAtPath(
  runtime: ModelUiRuntime,
  path: string
): ModelObject {
  const object = Object.values(runtime.model.objects).find(
    (candidate) => runtime.ui[candidate.id]?.navigation?.path === path
  )
  if (!object) throw notFound()
  return object
}
/** Intent preloading uses the same cache and generated client as rendered collections. */
export async function preloadObject(
  runtime: ModelUiRuntime,
  cache: QueryClient,
  object: ModelObject,
  recordId: string
) {
  if (runtime.ui[object.id]?.record?.pageComponent !== undefined) return
  await cache.ensureQueryData(clientFor(runtime, object).get({ id: recordId }))
}

/** Preloads the selected view's exact filter and sort, so mounting does not issue another request. */
export async function preloadCollection(
  runtime: ModelUiRuntime,
  cache: QueryClient,
  object: ModelObject,
  search: ObjectCollectionSearch,
  views: ReadonlyArray<ObjectCollectionView> | undefined = runtime.ui[object.id]
    ?.collection?.views
) {
  if (runtime.ui[object.id]?.collection?.pageComponent !== undefined) return
  const state =
    views === undefined
      ? (search.state ?? emptyObjectCollectionViewState)
      : resolveObjectCollectionView(views, search).state
  await cache.ensureInfiniteQueryData(
    modelCollectionQuery(
      clientFor(runtime, object).list,
      objectListRequest(
        object,
        state.filters,
        state.sorting,
        undefined,
        collectionDateWindow(
          state.layout,
          calendarDay(state.date) ?? new Date().toISOString().slice(0, 10)
        )
      )
    )
  )
}
