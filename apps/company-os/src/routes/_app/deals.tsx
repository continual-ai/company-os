import { AcmeModel } from "@acme/api"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Deals",
  description:
    AcmeModel.objects.deal.description ?? "Browse Acme deal records.",
  title: "Deals",
}

export const Route = createFileRoute("/_app/deals")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={AcmeModel.objects.deal} />,
})
