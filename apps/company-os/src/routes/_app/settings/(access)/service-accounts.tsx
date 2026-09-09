import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { pageOptions } from "#/app/route-metadata.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"

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
  return <ModelCollectionPage object={EnabledModel.objects.serviceAccount} />
}
