import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales/deals")({
  ...pageOptions({
    breadcrumb: "Deals",
    description: Model.objects.deal.description ?? "Browse deal records.",
    title: "Deals",
  }),
})
