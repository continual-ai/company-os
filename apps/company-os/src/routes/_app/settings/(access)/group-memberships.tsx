import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { pageOptions } from "#/app/route-metadata.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"

export const Route = createFileRoute(
  "/_app/settings/(access)/group-memberships"
)({
  ...pageOptions({
    breadcrumb: "Group memberships",
    description: "Add users and service accounts to groups.",
    title: "Group memberships",
  }),
  component: () => (
    <ModelCollectionPage object={EnabledModel.objects.groupMembership} />
  ),
})
