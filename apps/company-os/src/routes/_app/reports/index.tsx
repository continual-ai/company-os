import { createFileRoute } from "@tanstack/react-router"

import { ReportsDirectory } from "#/app/customization/workspace-pages.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

export const Route = createFileRoute("/_app/reports/")({
  ...pageOptions({
    title: "Reports",
    breadcrumb: "Reports",
    description: "Dashboards and saved analyses.",
  }),
  component: ReportsDirectory,
})
