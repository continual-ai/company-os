import { createFileRoute } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"
import { ModelCollectionPage } from "#/ui/model/model-pages.tsx"

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
