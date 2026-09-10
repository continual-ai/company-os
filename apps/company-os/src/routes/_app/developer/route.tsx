import { Outlet, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "#/app/ui/route-metadata.ts"

const page = {
  breadcrumb: "Developer Center",
  description:
    "Inspect the domain model and generated interfaces, then extend the system from shared contracts.",
  title: "Developer Center",
}

export const Route = createFileRoute("/_app/developer")({
  ...pageOptions(page),
  component: Outlet,
})
