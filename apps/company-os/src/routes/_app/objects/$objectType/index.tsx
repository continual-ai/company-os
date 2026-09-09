import { createFileRoute } from "@tanstack/react-router"

import { presentation } from "#/app/app-presentation.ts"
import { objectCollectionRoute } from "#/app/ui/model/object-routes.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"
import { routeObject } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

function resolveObject({ objectType }: { readonly objectType: string }) {
  return routeObject(presentation, objectType)
}

export const Route = createFileRoute("/_app/objects/$objectType/")({
  ...objectCollectionRoute(resolveObject),
  component: CollectionPage,
})

function CollectionPage() {
  const runtime = useModelRuntime()
  const object = routeObject(runtime, Route.useParams().objectType)
  const navigate = Route.useNavigate()
  return (
    <ModelCollectionPage
      object={object}
      search={Route.useSearch()}
      onSearchChange={(search) => void navigate({ search })}
    />
  )
}
