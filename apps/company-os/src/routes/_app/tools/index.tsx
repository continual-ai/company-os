import { createFileRoute } from "@tanstack/react-router"

import { ToolsDirectory } from "#/app/customization/workspace-pages.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

export const Route = createFileRoute("/_app/tools/")({
  ...pageOptions({
    title: "Tools",
    breadcrumb: "Tools",
    description: "Tools for your team's work.",
  }),
  component: ToolsDirectory,
})
