import type { ObjectType } from "@company/runtime"
import {
  type ObjectCollectionSearch,
  type ObjectCollectionView,
} from "@company/ui/model/collection-view"
import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { modelUi } from "#/app.ui.ts"
import { modelCollectionQuery } from "#/model-collection-query.ts"
import {
  calendarDay,
  collectionDateWindow,
} from "#/ui/model/collection-dates.ts"
import { clientFor, type ModelObject } from "#/ui/model/object-client.ts"
import { objectListRequest } from "#/ui/model/object-collection-query.ts"
import {
  emptyObjectCollectionViewState,
  resolveObjectCollectionView,
} from "#/ui/model/object-collection-view.ts"

export function objectHref(object: ObjectType, recordId?: string) {
  const base = modelUi[object.id]?.navigation?.path ?? `/objects/${object.id}`
  return recordId === undefined
    ? base
    : `${base}/${encodeURIComponent(recordId)}`
}
export function routeObject(id: string): ModelObject {
  const object = Object.values(Model.objects).find(
    (candidate) => candidate.id === id
  )
  if (!object) throw notFound()
  return object
}
/** Intent preloading uses the same cache and generated client as rendered collections. */
export async function preloadObject(
  cache: QueryClient,
  object: ModelObject,
  recordId: string
) {
  if (modelUi[object.id]?.record?.pageComponent !== undefined) return
  await cache.ensureQueryData(clientFor(object).get({ id: recordId }))
}

/** Preloads the selected view's exact filter and sort, so mounting does not issue another request. */
export async function preloadCollection(
  cache: QueryClient,
  object: ModelObject,
  search: ObjectCollectionSearch,
  views: ReadonlyArray<ObjectCollectionView> | undefined = modelUi[object.id]
    ?.collection?.views
) {
  if (modelUi[object.id]?.collection?.pageComponent !== undefined) return
  const state =
    views === undefined
      ? (search.state ?? emptyObjectCollectionViewState)
      : resolveObjectCollectionView(views, search).state
  await cache.ensureInfiniteQueryData(
    modelCollectionQuery(
      clientFor(object).list,
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
