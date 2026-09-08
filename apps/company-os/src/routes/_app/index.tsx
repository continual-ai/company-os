import { createFileRoute } from "@tanstack/react-router"

import { appConfig } from "@/customization/config"
import { Home } from "@/customization/home"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Home",
  description: appConfig.home.description,
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: Home,
})
