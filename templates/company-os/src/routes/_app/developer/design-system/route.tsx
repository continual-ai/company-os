import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { DesignSystemLayout } from "@/ui/developer/design-system/design-system-layout"

const page = {
  breadcrumb: "Design system",
  description:
    "Develop and verify the shared interface foundations, components, and proven product patterns.",
  title: "Design system",
}

export const Route = createFileRoute("/_app/developer/design-system")({
  ...pageOptions(page),
  component: DesignSystemLayout,
})
