import { ModelCollectionPage } from "@company/runtime/ui/model/model-pages"
import { createFileRoute } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"

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
