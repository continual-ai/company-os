import { createFileRoute } from "@tanstack/react-router"

import { presentation } from "#/app/app-presentation.ts"
import { objectCollectionRoute } from "#/app/ui/model/object-routes.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"
import { routeObjectAtPath } from "#/runtime/ui/model/object-routing.ts"

/** Access objects declare `/settings/<collection>` as their navigation path. */
function resolveObject({ collection }: { readonly collection: string }) {
  return routeObjectAtPath(presentation, `/settings/${collection}`)
}

export const Route = createFileRoute("/_app/settings/$collection/")({
  ...objectCollectionRoute(resolveObject),
  component: CollectionPage,
})

function CollectionPage() {
  const object = resolveObject(Route.useParams())
  const navigate = Route.useNavigate()
  return (
    <ModelCollectionPage
      object={object}
      search={Route.useSearch()}
      onSearchChange={(search) => void navigate({ search })}
    />
  )
}
