import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { pageOptions } from "#/app/route-metadata.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"

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
    <ModelCollectionPage object={EnabledModel.objects.roleAssignment} />
  ),
})
