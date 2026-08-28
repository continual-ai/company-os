import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

export const Route = createFileRoute(
  "/_app/settings/(access)/role-assignments"
)({
  ...pageOptions({
    breadcrumb: "Role assignments",
    description:
      "Grant a role to a user, service account, or group at one scope.",
    title: "Role assignments",
  }),
  component: () => <ObjectCollection object={Model.objects.roleAssignment} />,
})
