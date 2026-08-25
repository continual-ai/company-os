import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Interactions",
  description: Model.objects.interaction.description ?? "Browse interactions.",
  title: "Interactions",
}

export const Route = createFileRoute("/_app/interactions")({
  ...pageOptions(page),
  component: () => <ObjectCollection object={Model.objects.interaction} />,
})
