import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/settings/role-assignments")({
  ...pageOptions({
    breadcrumb: "Role assignments",
    description:
      "Grant a role to a user, service account, or group at one scope.",
    title: "Role assignments",
  }),
  component: () => <ObjectCollection object={Model.objects.roleAssignment} />,
})
