import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectRecordPage } from "@/ui/model/object-record-page"
import {
  objectRecordTabSearch,
  validateObjectRecordSearch,
} from "@/ui/model/object-record-view"

const page = {
  breadcrumb: "Note",
  description: "View note details and relationships.",
  title: "Note",
}

export const Route = createFileRoute("/_app/_sales/notes/$recordId")({
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: NoteRecord,
})

function NoteRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ObjectRecordPage
      object={Model.objects.note}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
