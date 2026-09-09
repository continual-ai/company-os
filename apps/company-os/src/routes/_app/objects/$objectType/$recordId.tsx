import { createFileRoute } from "@tanstack/react-router"

import { presentation } from "#/app/app-presentation.ts"
import { documentHead } from "#/app/route-metadata.ts"
import { ModelRecordPage } from "#/runtime/ui/model/model-pages.tsx"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "#/runtime/ui/model/object-record-view.ts"
import {
  preloadObject,
  routeObject,
} from "#/runtime/ui/model/object-routing.ts"
export const Route = createFileRoute("/_app/objects/$objectType/$recordId")({
  loader: async ({ params, context }) => {
    const object = routeObject(presentation, params.objectType)
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
  head: ({ loaderData }) =>
    documentHead(loaderData?.page ?? { title: "Record", description: "" }),
  validateSearch: validateObjectRecordSearch,
  component: RecordPage,
})
function RecordPage() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const { objectType, recordId } = Route.useParams()
  return (
    <ModelRecordPage
      key={`${objectType}:${recordId}`}
      object={routeObject(presentation, objectType)}
      recordId={recordId}
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
