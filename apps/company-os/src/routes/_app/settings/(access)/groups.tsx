import { ModelCollectionPage } from "@company/runtime/ui/model/model-pages"
import { createFileRoute } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"

export const Route = createFileRoute("/_app/settings/(access)/groups")({
  ...pageOptions({
    breadcrumb: "Groups",
    description: "Manage reusable collections of identities.",
    title: "Groups",
  }),
  component: GroupsPage,
})

function GroupsPage() {
  return <ModelCollectionPage object={Model.objects.group} />
}
