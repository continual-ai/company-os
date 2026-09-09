import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { pageOptions } from "#/app/route-metadata.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"

export const Route = createFileRoute("/_app/settings/(access)/roles")({
  ...pageOptions({
    breadcrumb: "Roles",
    description: "Review permission sets.",
    title: "Roles",
  }),
  component: RolesPage,
})

function RolesPage() {
  return <ModelCollectionPage object={EnabledModel.objects.role} />
}
