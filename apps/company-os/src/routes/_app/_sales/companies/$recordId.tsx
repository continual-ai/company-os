import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectRecordPage } from "@/ui/model/object-record-page"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@/ui/model/object-record-view"

const page = {
  breadcrumb: "Company",
  description: "View company details and relationships.",
  title: "Company",
}

export const Route = createFileRoute("/_app/_sales/companies/$recordId")({
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: CompanyRecord,
})

function CompanyRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ObjectRecordPage
      object={Model.objects.company}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
