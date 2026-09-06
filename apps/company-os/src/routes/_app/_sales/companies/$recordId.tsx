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
  breadcrumb: "Company",
  description: "View company details and relationships.",
  title: "Company",
}

export const Route = createFileRoute("/_app/_sales/companies/$recordId")({
  loader: ({ params, context }) =>
    preloadObject(context.queryClient, Model.objects.company, params.recordId),
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: CompanyRecord,
})

function CompanyRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ModelRecordPage
      object={Model.objects.company}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
