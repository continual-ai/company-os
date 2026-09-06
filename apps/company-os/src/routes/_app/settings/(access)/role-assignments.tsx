import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

export const Route = createFileRoute(
  "/_app/settings/(access)/role-assignments"
)({
  ...pageOptions({
    breadcrumb: "Role assignments",
    description:
      "Grant a role to a user, service account, or group at one scope.",
    title: "Role assignments",
  }),
  component: () => (
    <ModelCollectionPage object={Model.objects.roleAssignment} />
  ),
})
