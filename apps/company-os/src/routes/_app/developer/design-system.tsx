import { createFileRoute } from "@tanstack/react-router"

import { DesignSystemGallery } from "#/app/ui/developer/design-system/gallery.tsx"
import { pageOptions } from "#/app/ui/route-metadata.ts"

export const Route = createFileRoute("/_app/developer/design-system")({
  ...pageOptions({
    breadcrumb: "Design system",
    title: "Design system",
    description: "Explore shared components and core application patterns.",
  }),
  component: DesignSystemGallery,
})
