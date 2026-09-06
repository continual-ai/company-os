import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales/leads")({
  ...pageOptions({
    breadcrumb: "Leads",
    description: Model.objects.lead.description ?? "Browse lead records.",
    title: "Leads",
  }),
})
