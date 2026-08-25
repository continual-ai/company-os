import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Line items",
  description: Model.objects.lineItem.description ?? "Browse line items.",
  title: "Line items",
}

export const Route = createFileRoute("/_app/line-items")({
  ...pageOptions(page),
  component: () => <ObjectCollection object={Model.objects.lineItem} />,
})
