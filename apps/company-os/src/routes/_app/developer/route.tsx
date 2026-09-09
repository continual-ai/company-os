import { Outlet, createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "#/app/route-metadata.ts"
import { CapabilityBoundary } from "#/app/ui/application/capability-boundary.tsx"
import { allowedCapabilitiesQuery } from "#/app/ui/application/load-capabilities.ts"
import { applicationCapabilities } from "#/runtime/client/capabilities.ts"

const page = {
  breadcrumb: "Developer Center",
  description:
    "Inspect the domain model and generated interfaces, then extend the system from shared contracts.",
  title: "Developer Center",
}

export const Route = createFileRoute("/_app/developer")({
  ...pageOptions(page),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      allowedCapabilitiesQuery([applicationCapabilities.develop])
    )
  },
  component: DeveloperCenterLayout,
})

function DeveloperCenterLayout() {
  return (
    <CapabilityBoundary
      permission={applicationCapabilities.develop.permission}
      title="Development tools are not available"
      description="This identity can use only the operating capabilities assigned to it. Ask an administrator for access to the model and interface development tools."
    >
      <Outlet />
    </CapabilityBoundary>
  )
}
