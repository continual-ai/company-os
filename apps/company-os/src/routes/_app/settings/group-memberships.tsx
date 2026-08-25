import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/settings/group-memberships")({
  ...pageOptions({
    breadcrumb: "Group memberships",
    description: "Add users and service accounts to groups.",
    title: "Group memberships",
  }),
  component: () => <ObjectCollection object={Model.objects.groupMembership} />,
})
