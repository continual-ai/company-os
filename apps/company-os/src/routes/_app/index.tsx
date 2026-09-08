import { createFileRoute } from "@tanstack/react-router"

import { appConfig } from "#/customization/config.ts"
import { Home } from "#/customization/home.tsx"
import { pageOptions } from "#/route-metadata.ts"

const page = {
  breadcrumb: "Home",
  description: appConfig.home.description,
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: Home,
})
