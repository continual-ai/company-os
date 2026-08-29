import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectRecordPage } from "@/ui/model/object-record-page"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@/ui/model/object-record-view"
import { LeadActions } from "@/ui/sales/leads-page"

const page = {
  breadcrumb: "Lead",
  description: "View lead details and relationships.",
  title: "Lead",
}

export const Route = createFileRoute("/_app/_sales/leads/$recordId")({
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: LeadRecord,
})

function LeadRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ObjectRecordPage
      object={Model.objects.lead}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
      renderActions={({ can, record, refresh }) => (
        <LeadActions
          canConvert={can("convert")}
          record={record}
          refresh={refresh}
        />
      )}
    />
  )
}
