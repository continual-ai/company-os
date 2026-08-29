import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectRecordPage } from "@/ui/model/object-record-page"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@/ui/model/object-record-view"

const page = {
  breadcrumb: "Contact",
  description: "View contact details and relationships.",
  title: "Contact",
}

export const Route = createFileRoute("/_app/_sales/contacts/$recordId")({
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: ContactRecord,
})

function ContactRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ObjectRecordPage
      object={Model.objects.contact}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
