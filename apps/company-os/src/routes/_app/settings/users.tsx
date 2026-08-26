import { Model } from "@company/model"
import { createFileRoute } from "@tanstack/react-router"

import { ObjectCollection } from "@/components/object-collection"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Users",
  description: "Review people projected from the deployment identity provider.",
  title: "Users",
}

export const Route = createFileRoute("/_app/settings/users")({
  ...pageOptions(page),
  component: UsersSettings,
})

function UsersSettings() {
  return <ObjectCollection object={Model.objects.user} />
}
