import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

const page = {
  breadcrumb: "Companies",
  description: Model.objects.company.description ?? "Browse company records.",
  title: "Companies",
}

export const Route = createFileRoute("/_app/(sales)/companies")({
  ...pageOptions(page),
  component: CompaniesPage,
})

function CompaniesPage() {
  return <ObjectCollection object={Model.objects.company} />
}
