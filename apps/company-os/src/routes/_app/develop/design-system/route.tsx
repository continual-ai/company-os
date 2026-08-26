import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"
import { DesignSystemLayout } from "@/ui/develop/design-system/design-system-layout"

const page = {
  breadcrumb: "Design system",
  description:
    "Develop and verify the shared interface foundations, components, and proven product patterns.",
  title: "Design system",
}

export const Route = createFileRoute("/_app/develop/design-system")({
  ...pageOptions(page),
  component: DesignSystemLayout,
})
