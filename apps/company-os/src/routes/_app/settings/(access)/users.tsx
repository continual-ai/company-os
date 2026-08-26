import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { ObjectCollection } from "@/ui/model/object-collection"

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
  return <ObjectCollection object={Model.objects.user} />
}
