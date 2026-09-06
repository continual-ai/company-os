import { createFileRoute } from "@tanstack/react-router"

import { documentHead } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"
import { validateObjectCollectionSearch } from "@/ui/model/object-collection-view"
import { preloadCollection, routeObject } from "@/ui/model/object-routing"
export const Route = createFileRoute("/_app/objects/$objectType/")({
  validateSearch: validateObjectCollectionSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const object = routeObject(params.objectType)
    await preloadCollection(object, deps)
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
  const object = routeObject(Route.useParams().objectType)
  const navigate = Route.useNavigate()
  return (
    <ModelCollectionPage
      object={object}
      search={Route.useSearch()}
      onSearchChange={(search) => void navigate({ search })}
    />
  )
}
