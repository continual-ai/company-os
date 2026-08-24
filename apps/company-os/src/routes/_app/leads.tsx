import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Leads",
  description: Model.objects.lead.description ?? "Browse lead records.",
  title: "Leads",
}

export const Route = createFileRoute("/_app/leads")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={Model.objects.lead} />,
})
