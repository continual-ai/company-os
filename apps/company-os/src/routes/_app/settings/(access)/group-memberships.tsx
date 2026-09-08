import { createFileRoute } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"
import { ModelCollectionPage } from "#/ui/model/model-pages.tsx"

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
