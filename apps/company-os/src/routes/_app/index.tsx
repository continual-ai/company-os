import { createFileRoute } from "@tanstack/react-router"

import { Home } from "@/customization/home"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Home",
  description:
    "Manage customer relationships, track delivery, and keep the work connected.",
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: Home,
})
