import { createFileRoute } from "@tanstack/react-router"

import { documentHead } from "#/route-metadata.ts"
import { ModelRecordPage } from "#/ui/model/model-pages.tsx"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "#/ui/model/object-record-view.ts"
import { preloadObject, routeObject } from "#/ui/model/object-routing.ts"
export const Route = createFileRoute("/_app/objects/$objectType/$recordId")({
  loader: async ({ params, context }) => {
    const object = routeObject(params.objectType)
    await preloadObject(context.queryClient, object, params.recordId)
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
      object={routeObject(objectType)}
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
