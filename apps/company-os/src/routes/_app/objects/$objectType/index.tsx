import { ModelCollectionPage } from "@company/runtime/ui/model/model-pages"
import { validateObjectCollectionSearch } from "@company/runtime/ui/model/object-collection-view"
import {
  preloadCollection,
  routeObject,
} from "@company/runtime/ui/model/object-routing"
import { createFileRoute } from "@tanstack/react-router"

import { presentation } from "#/app-presentation.ts"
import { documentHead } from "#/route-metadata.ts"
export const Route = createFileRoute("/_app/objects/$objectType/")({
  validateSearch: validateObjectCollectionSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps, context }) => {
    const object = routeObject(presentation, params.objectType)
    await preloadCollection(presentation, context.queryClient, object, deps)
    return {
      page: {
        breadcrumb: object.pluralName,
        title: object.pluralName,
        description: object.description ?? "",
      },
    }
  },
  head: ({ loaderData }) =>
    documentHead(loaderData?.page ?? { title: "Records", description: "" }),
  component: CollectionPage,
})
function CollectionPage() {
  const object = routeObject(presentation, Route.useParams().objectType)
  const navigate = Route.useNavigate()
  return (
    <ModelCollectionPage
      object={object}
      search={Route.useSearch()}
      onSearchChange={(search) => void navigate({ search })}
    />
  )
}
