import { notFound } from "@tanstack/react-router"
import { Model } from "company-os/model"
import { Effect } from "effect"

import { modelUi } from "@/app-ui"

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
export async function preloadObject(object: ModelObject, recordId: string) {
  if (typeof window === "undefined") return
  await Effect.runPromise(clientFor(object).get({ id: recordId }))
}

/** Preloads the selected view's exact filter and sort, so mounting does not issue another request. */
export async function preloadCollection(
  object: ModelObject,
  search: ObjectCollectionSearch,
  views: ReadonlyArray<ObjectCollectionView> | undefined = modelUi[object.id]
    ?.collection?.views
) {
  if (typeof window === "undefined") return
  const state =
    views === undefined
      ? (search.state ?? emptyObjectCollectionViewState)
      : resolveObjectCollectionView(views, search).state
  await Effect.runPromise(
    clientFor(object).list(
      objectListRequest(object, state.filters, state.sorting)
    )
  )
}
