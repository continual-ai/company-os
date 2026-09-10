import { createFileRoute } from "@tanstack/react-router"

import { DataDirectory } from "#/app/customization/workspace-pages.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

export const Route = createFileRoute("/_app/data")({
  ...pageOptions({
    title: "Data",
    breadcrumb: "Data",
    description: "Browse your company's shared records.",
  }),
  component: DataDirectory,
})
