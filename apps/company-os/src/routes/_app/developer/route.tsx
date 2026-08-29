import { Outlet, createFileRoute } from "@tanstack/react-router"

import { applicationCapabilities } from "@/capabilities"
import { pageOptions } from "@/route-metadata"
import { CapabilityBoundary } from "@/ui/application/capability-boundary"

const page = {
  breadcrumb: "Developer Center",
  description:
    "Inspect the domain model and generated interfaces, then extend the system from shared contracts.",
  title: "Developer Center",
}

export const Route = createFileRoute("/_app/developer")({
  ...pageOptions(page),
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
