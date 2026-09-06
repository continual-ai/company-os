import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelRecordPage } from "@/ui/model/model-pages"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@/ui/model/object-record-view"
import { preloadObject } from "@/ui/model/object-routing"

const page = {
  breadcrumb: "Deal",
  description: "View deal details and relationships.",
  title: "Deal",
}

export const Route = createFileRoute("/_app/_sales/deals/$recordId")({
  loader: ({ params }) => preloadObject(Model.objects.deal, params.recordId),
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: DealRecord,
})

function DealRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ModelRecordPage
      object={Model.objects.deal}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
