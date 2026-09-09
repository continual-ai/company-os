import type { QueryClient } from "@tanstack/react-query"

import { presentation } from "#/app/app-presentation.ts"
import { documentHead, type PageMetadata } from "#/app/ui/route-metadata.ts"
import type { ObjectCollectionSearch } from "#/runtime/ui/model/collection-view.ts"
import type { ModelObject } from "#/runtime/ui/model/object-client.ts"
import { validateObjectCollectionSearch } from "#/runtime/ui/model/object-collection-view.ts"
import { validateObjectRecordSearch } from "#/runtime/ui/model/object-record-view.ts"
import {
  preloadCollection,
  preloadObject,
} from "#/runtime/ui/model/object-routing.ts"

interface RouteContext {
  readonly queryClient: QueryClient
}
interface PageLoaderData {
  readonly page: PageMetadata
}

/** Every collection URL validates the same search state and preloads the exact request its screen renders. */
export function objectCollectionRoute<Params>(
  resolve: (params: Params) => ModelObject
) {
  return {
    validateSearch: validateObjectCollectionSearch,
    loaderDeps: ({ search }: { search: ObjectCollectionSearch }) => search,
    loader: async ({
      params,
      deps,
      context,
    }: {
      params: Params
      deps: ObjectCollectionSearch
      context: RouteContext
    }): Promise<PageLoaderData> => {
      const object = resolve(params)
      await preloadCollection(presentation, context.queryClient, object, deps)
      return {
        page: {
          breadcrumb: object.pluralName,
          title: object.pluralName,
          description: object.description ?? "",
        },
      }
    },
    head: ({ loaderData }: { loaderData?: PageLoaderData | undefined }) =>
      documentHead(loaderData?.page ?? { title: "Records", description: "" }),
  }
}

export function objectRecordRoute<Params>(
  resolve: (params: Params) => ModelObject
) {
  return {
    validateSearch: validateObjectRecordSearch,
    loader: async ({
      params,
      context,
    }: {
      params: Params & { readonly recordId: string }
      context: RouteContext
    }): Promise<PageLoaderData> => {
      const object = resolve(params)
      await preloadObject(
        presentation,
        context.queryClient,
        object,
        params.recordId
      )
      return {
        page: {
          breadcrumb: object.name,
          title: object.name,
          description: object.description ?? "",
        },
      }
    },
    head: ({ loaderData }: { loaderData?: PageLoaderData | undefined }) =>
      documentHead(loaderData?.page ?? { title: "Record", description: "" }),
  }
}
