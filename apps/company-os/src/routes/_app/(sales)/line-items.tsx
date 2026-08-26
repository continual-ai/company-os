import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

const page = {
  breadcrumb: "Deal line items",
  description: Model.objects.lineItem.description ?? "Browse line items.",
  title: "Deal line items",
}

export const Route = createFileRoute("/_app/(sales)/line-items")({
  ...pageOptions(page),
  component: () => <ObjectCollection object={Model.objects.lineItem} />,
})
