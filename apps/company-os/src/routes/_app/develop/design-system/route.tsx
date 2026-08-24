import { createFileRoute } from "@tanstack/react-router"

import { DesignSystemLayout } from "@/components/design-system/design-system-layout"
import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "Design system",
  description:
    "Develop and verify the source-owned interface foundations, components, and proven product patterns.",
  title: "Design system",
}

export const Route = createFileRoute("/_app/develop/design-system")({
  ...pageOptions(page),
  component: DesignSystemLayout,
})
