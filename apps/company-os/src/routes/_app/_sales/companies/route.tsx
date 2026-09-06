import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales/companies")({
  ...pageOptions({
    breadcrumb: "Companies",
    description: Model.objects.company.description ?? "Browse company records.",
    title: "Companies",
  }),
})
