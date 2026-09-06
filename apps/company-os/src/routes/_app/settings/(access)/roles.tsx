import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

export const Route = createFileRoute("/_app/settings/(access)/roles")({
  ...pageOptions({
    breadcrumb: "Roles",
    description: "Review permission sets.",
    title: "Roles",
  }),
  component: RolesPage,
})

function RolesPage() {
  return <ModelCollectionPage object={Model.objects.role} />
}
