import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

const page = {
  breadcrumb: "Activity",
  description: Model.objects.interaction.description ?? "Browse interactions.",
  title: "Activity",
}

export const Route = createFileRoute("/_app/(sales)/interactions")({
  ...pageOptions(page),
  component: () => <ObjectCollection object={Model.objects.interaction} />,
})
