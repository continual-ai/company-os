import { AcmeModel } from "@acme/api"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Leads",
  description:
    AcmeModel.objects.lead.description ?? "Browse Acme lead records.",
  title: "Leads",
}

export const Route = createFileRoute("/_app/leads")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={AcmeModel.objects.lead} />,
})
