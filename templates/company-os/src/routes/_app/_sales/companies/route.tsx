import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales/companies")({
  ...pageOptions({
    breadcrumb: "Companies",
    description: Model.objects.company.description ?? "Browse company records.",
    title: "Companies",
  }),
})
