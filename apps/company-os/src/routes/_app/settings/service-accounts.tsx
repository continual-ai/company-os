import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Service accounts",
  description:
    "Review software, integration, and agent identities projected from the deployment identity provider.",
  title: "Service accounts",
}

export const Route = createFileRoute("/_app/settings/service-accounts")({
  ...pageOptions(page),
  component: ServiceAccountsSettings,
})

function ServiceAccountsSettings() {
  return <ObjectCollection object={Model.objects.serviceAccount} />
}
