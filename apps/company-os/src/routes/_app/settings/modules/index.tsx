import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "#/app/ui/route-metadata.ts"
import { ModulesSettings } from "#/app/ui/settings/modules-settings.tsx"

export const Route = createFileRoute("/_app/settings/modules/")({
  ...pageOptions({
    title: "Modules",
    breadcrumb: "Modules",
    description: "Discover and enable capabilities for your company.",
  }),
  component: ModulesSettings,
})
