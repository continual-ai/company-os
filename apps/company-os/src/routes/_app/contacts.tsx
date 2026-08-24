import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Contacts",
  description: Model.objects.contact.description ?? "Browse contact records.",
  title: "Contacts",
}

export const Route = createFileRoute("/_app/contacts")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={Model.objects.contact} />,
})
