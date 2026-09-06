import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

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
