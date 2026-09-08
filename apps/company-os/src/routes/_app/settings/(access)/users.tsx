import { ModelCollectionPage } from "@company/runtime/ui/model/model-pages"
import { createFileRoute } from "@tanstack/react-router"

import { Model } from "#/app.model.ts"
import { pageOptions } from "#/route-metadata.ts"

const page = {
  breadcrumb: "Users",
  description: "Review people projected from the deployment identity provider.",
  title: "Users",
}

export const Route = createFileRoute("/_app/settings/(access)/users")({
  ...pageOptions(page),
  component: UsersSettings,
})

function UsersSettings() {
  return <ModelCollectionPage object={Model.objects.user} />
}
