import { createFileRoute } from "@tanstack/react-router"

import { documentHead } from "@/route-metadata"
import { ModelRecordPage } from "@/ui/model/model-pages"
import { preloadObject, routeObject } from "@/ui/model/object-routing"
export const Route = createFileRoute("/_app/objects/$objectType/$recordId")({
  loader: async ({ params }) => {
    const object = routeObject(params.objectType)
    await preloadObject(object, params.recordId)
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
  component: RecordPage,
})
function RecordPage() {
  const { objectType, recordId } = Route.useParams()
  return (
    <ModelRecordPage
      key={`${objectType}:${recordId}`}
      object={routeObject(objectType)}
      recordId={recordId}
    />
  )
}
