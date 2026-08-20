import { AcmeModel } from "@acme/api"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectBrowser } from "@/components/object-browser"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Companies",
  description:
    AcmeModel.objects.company.description ?? "Browse Acme company records.",
  title: "Companies",
}

export const Route = createFileRoute("/_app/companies")({
  ...pageOptions(page),
  component: () => <ObjectBrowser object={AcmeModel.objects.company} />,
})
