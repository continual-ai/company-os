import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectRecordPage } from "@/ui/model/object-record-page"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@/ui/model/object-record-view"

const page = {
  breadcrumb: "Deal",
  description: "View deal details and relationships.",
  title: "Deal",
}

export const Route = createFileRoute("/_app/_sales/deals/$recordId")({
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: DealRecord,
})

function DealRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ObjectRecordPage
      object={Model.objects.deal}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
