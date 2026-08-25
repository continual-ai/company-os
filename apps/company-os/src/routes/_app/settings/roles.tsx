import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/settings/roles")({
  ...pageOptions({
    breadcrumb: "Roles",
    description: "Review source-owned permission sets.",
    title: "Roles",
  }),
  component: () => <ObjectCollection object={Model.objects.role} />,
})
