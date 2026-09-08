import { createFileRoute } from "@tanstack/react-router"

import { documentHead } from "#/route-metadata.ts"
import { ModelCollectionPage } from "#/ui/model/model-pages.tsx"
import { validateObjectCollectionSearch } from "#/ui/model/object-collection-view.ts"
import { preloadCollection, routeObject } from "#/ui/model/object-routing.ts"
export const Route = createFileRoute("/_app/objects/$objectType/")({
  validateSearch: validateObjectCollectionSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps, context }) => {
    const object = routeObject(params.objectType)
    await preloadCollection(context.queryClient, object, deps)
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
