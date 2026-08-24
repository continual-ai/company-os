import { Outlet, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Develop",
  description:
    "Inspect the domain model and generated interfaces, then extend the system from shared source-owned contracts.",
  title: "Develop",
}

export const Route = createFileRoute("/_app/develop")({
  ...pageOptions(page),
  component: DevelopLayout,
})

function DevelopLayout() {
  return <Outlet />
}
