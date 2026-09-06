import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

export const Route = createFileRoute(
  "/_app/settings/(access)/group-memberships"
)({
  ...pageOptions({
    breadcrumb: "Group memberships",
    description: "Add users and service accounts to groups.",
    title: "Group memberships",
  }),
  component: () => (
    <ModelCollectionPage object={Model.objects.groupMembership} />
  ),
})
