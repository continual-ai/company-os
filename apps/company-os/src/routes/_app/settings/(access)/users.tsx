import { createFileRoute } from "@tanstack/react-router"
import { Model } from "company-os/model"

import { pageOptions } from "@/route-metadata"
import { ModelCollectionPage } from "@/ui/model/model-pages"

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
