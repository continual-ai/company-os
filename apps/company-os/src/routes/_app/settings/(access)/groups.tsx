import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { pageOptions } from "#/app/route-metadata.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"

export const Route = createFileRoute("/_app/settings/(access)/groups")({
  ...pageOptions({
    breadcrumb: "Groups",
    description: "Manage reusable collections of identities.",
    title: "Groups",
  }),
  component: GroupsPage,
})

function GroupsPage() {
  return <ModelCollectionPage object={EnabledModel.objects.group} />
}
