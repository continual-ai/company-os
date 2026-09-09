import { createFileRoute } from "@tanstack/react-router"

import { presentation } from "#/app/app-presentation.ts"
import { objectRecordRoute } from "#/app/ui/model/object-routes.ts"
import { ModelRecordPage } from "#/runtime/ui/model/model-pages.tsx"
import { objectRecordTabSearch } from "#/runtime/ui/model/object-record-view.ts"
import { routeObjectAtPath } from "#/runtime/ui/model/object-routing.ts"
import { useModelRuntime } from "#/runtime/ui/model/runtime-context.tsx"

/** Access objects declare `/settings/<collection>` as their navigation path. */
function resolveObject({ collection }: { readonly collection: string }) {
  return routeObjectAtPath(presentation, `/settings/${collection}`)
}

export const Route = createFileRoute("/_app/settings/$collection/$recordId")({
  ...objectRecordRoute(resolveObject),
  component: RecordPage,
})

function RecordPage() {
  const runtime = useModelRuntime()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const params = Route.useParams()
  return (
    <ModelRecordPage
      key={`${params.collection}:${params.recordId}`}
      object={routeObjectAtPath(runtime, `/settings/${params.collection}`)}
      recordId={params.recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({
          replace: true,
          resetScroll: false,
          search: objectRecordTabSearch(tab),
        })
      }
    />
  )
}
