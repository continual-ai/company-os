import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

const page = {
  breadcrumb: "Notes",
  description: Model.objects.note.description ?? "Browse notes.",
  title: Model.objects.note.pluralName,
}

export const Route = createFileRoute("/_app/(sales)/notes")({
  ...pageOptions(page),
  component: () => <ObjectCollection object={Model.objects.note} />,
})
