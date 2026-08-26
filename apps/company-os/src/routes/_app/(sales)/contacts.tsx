import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

const page = {
  breadcrumb: "Contacts",
  description: Model.objects.contact.description ?? "Browse contact records.",
  title: "Contacts",
}

export const Route = createFileRoute("/_app/(sales)/contacts")({
  ...pageOptions(page),
  component: () => <ObjectCollection object={Model.objects.contact} />,
})
