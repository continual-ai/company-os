import { ModelCollectionPage } from "@company/runtime/ui/model/model-pages"
import { createFileRoute } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"

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
