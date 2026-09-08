import { ModelRecordPage } from "@company/runtime/ui/model/model-pages"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@company/runtime/ui/model/object-record-view"
import {
  preloadObject,
  routeObject,
} from "@company/runtime/ui/model/object-routing"
import { createFileRoute } from "@tanstack/react-router"

import { presentation } from "#/app-presentation.ts"
import { documentHead } from "#/route-metadata.ts"
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
