import { createFileRoute } from "@tanstack/react-router"

import { appConfig } from "#/app/customization/config.ts"
import { Home } from "#/app/customization/home.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

const page = {
  breadcrumb: "Home",
  description: appConfig.home.description,
  title: "Home",
}

export const Route = createFileRoute("/_app/")({
  ...pageOptions(page),
  component: Home,
})
