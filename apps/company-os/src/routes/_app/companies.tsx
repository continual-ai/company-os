import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Companies",
  description: Model.objects.company.description ?? "Browse company records.",
  title: "Companies",
}

export const Route = createFileRoute("/_app/companies")({
  ...pageOptions(page),
  component: CompaniesPage,
})

function CompaniesPage() {
  return <ObjectCollection object={Model.objects.company} />
}
