import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

const page = {
  breadcrumb: "Service accounts",
  description:
    "Review software, integration, and agent identities projected from the deployment identity provider.",
  title: "Service accounts",
}

export const Route = createFileRoute(
  "/_app/settings/(access)/service-accounts"
)({
  ...pageOptions(page),
  component: ServiceAccountsSettings,
})

function ServiceAccountsSettings() {
  return <ModelCollectionPage object={Model.objects.serviceAccount} />
}
