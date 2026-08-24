import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Deals",
  description: Model.objects.deal.description ?? "Browse deal records.",
  title: "Deals",
}

export const Route = createFileRoute("/_app/deals")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={Model.objects.deal} />,
})
