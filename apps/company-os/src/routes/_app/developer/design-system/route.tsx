import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "#/app/route-metadata.ts"
import { DesignSystemLayout } from "#/app/ui/developer/design-system/design-system-layout.tsx"

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
