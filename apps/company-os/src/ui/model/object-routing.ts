import type { QueryClient } from "@tanstack/react-query"
import { notFound } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { modelUi } from "@/app-ui"

import { calendarDay, collectionDateWindow } from "./collection-dates"
import { clientFor, type ModelObject } from "./object-client"
import { objectListRequest } from "./object-collection-query"
import {
  emptyObjectCollectionViewState,
  resolveObjectCollectionView,
  type ObjectCollectionSearch,
  type ObjectCollectionView,
} from "./object-collection-view"

export function objectHref(object: ModelObject, recordId?: string) {
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
  await cache.ensureQueryData(
    clientFor(object).list(
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
