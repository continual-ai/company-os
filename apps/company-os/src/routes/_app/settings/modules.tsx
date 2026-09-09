import { createFileRoute } from "@tanstack/react-router"

import { allowedCapabilitiesQuery } from "#/app/ui/application/load-capabilities.ts"
import { pageOptions } from "#/app/ui/route-metadata.ts"
import { ModulesSettings } from "#/app/ui/settings/modules-settings.tsx"

export const Route = createFileRoute("/_app/settings/modules")({
  ...pageOptions({
    title: "Modules",
    breadcrumb: "Modules",
    description: "Discover and enable capabilities for your company.",
  }),
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(
      allowedCapabilitiesQuery([{ permission: "moduleSetting.setEnabled" }])
    ),
  component: ModulesSettings,
})
