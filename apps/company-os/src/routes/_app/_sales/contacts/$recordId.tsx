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
  breadcrumb: "Contact",
  description: "View contact details and relationships.",
  title: "Contact",
}

export const Route = createFileRoute("/_app/_sales/contacts/$recordId")({
  loader: ({ params, context }) =>
    preloadObject(context.queryClient, Model.objects.contact, params.recordId),
  ...pageOptions(page),
  validateSearch: validateObjectRecordSearch,
  component: ContactRecord,
})

function ContactRecord() {
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  return (
    <ModelRecordPage
      object={Model.objects.contact}
      recordId={Route.useParams().recordId}
      tab={search.tab}
      onTabChange={(tab) =>
        void navigate({ replace: true, search: objectRecordTabSearch(tab) })
      }
    />
  )
}
