import { createFileRoute } from "@tanstack/react-router"

import { EnabledModel } from "#/app.model.ts"
import { pageOptions } from "#/app/route-metadata.ts"
import { ModelCollectionPage } from "#/runtime/ui/model/model-pages.tsx"

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
  return <ModelCollectionPage object={EnabledModel.objects.user} />
}
