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
  breadcrumb: "Lead",
  description: "View lead details and relationships.",
  title: "Lead",
}

export const Route = createFileRoute("/_app/_sales/leads/$recordId")({
  loader: ({ params }) => preloadObject(Model.objects.lead, params.recordId),
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: LeadRecord,
})

function LeadRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ModelRecordPage
      object={Model.objects.lead}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
