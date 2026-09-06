import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

const page = {
  breadcrumb: "Deal line items",
  description: Model.objects.lineItem.description ?? "Browse line items.",
  title: "Deal line items",
}

export const Route = createFileRoute("/_app/_sales/line-items")({
  ...pageOptions(page),
  component: () => <ModelCollectionPage object={Model.objects.lineItem} />,
})
