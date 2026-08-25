import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/settings/groups")({
  ...pageOptions({
    breadcrumb: "Groups",
    description: "Manage reusable collections of identities.",
    title: "Groups",
  }),
  component: () => <ObjectCollection object={Model.objects.group} />,
})
