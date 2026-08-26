import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { LeadsPage } from "@/ui/sales/leads-page"

const page = {
  breadcrumb: "Leads",
  description: Model.objects.lead.description ?? "Browse lead records.",
  title: "Leads",
}

export const Route = createFileRoute("/_app/(sales)/leads")({
  ...pageOptions(page),
  component: LeadsPage,
})
