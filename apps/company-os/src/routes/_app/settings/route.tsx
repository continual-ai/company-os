import { Outlet, createFileRoute } from "@tanstack/react-router"

import { allowedCapabilitiesQuery } from "#/app/ui/application/load-capabilities.ts"
import { settingsChecks } from "#/app/ui/settings/settings-capabilities.ts"

export const Route = createFileRoute("/_app/settings")({
  loader: ({ context }) =>
    context.queryClient.prefetchQuery(allowedCapabilitiesQuery(settingsChecks)),
  component: SettingsLayout,
})

function SettingsLayout() {
  return <Outlet />
}
