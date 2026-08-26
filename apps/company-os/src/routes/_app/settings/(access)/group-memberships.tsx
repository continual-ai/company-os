import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

export const Route = createFileRoute(
  "/_app/settings/(access)/group-memberships"
)({
  ...pageOptions({
    breadcrumb: "Group memberships",
    description: "Add users and service accounts to groups.",
    title: "Group memberships",
  }),
  component: () => <ObjectCollection object={Model.objects.groupMembership} />,
})
