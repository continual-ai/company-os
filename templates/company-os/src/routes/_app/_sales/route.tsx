import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

export const Route = createFileRoute("/_app/_sales")({
  ...pageOptions({
    breadcrumb: "Sales",
    description: "Qualify leads and advance customer opportunities.",
    title: "Sales",
  }),
})
