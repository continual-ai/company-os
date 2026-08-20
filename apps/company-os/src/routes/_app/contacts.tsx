import { AcmeModel } from "@acme/api"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Contacts",
  description:
    AcmeModel.objects.contact.description ?? "Browse Acme contact records.",
  title: "Contacts",
}

export const Route = createFileRoute("/_app/contacts")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={AcmeModel.objects.contact} />,
})
