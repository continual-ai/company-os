import { createFileRoute, notFound } from "@tanstack/react-router"

import { ToolPreview } from "#/app/customization/workspace-pages.tsx"
import { toolPreviews } from "#/app/customization/workspace.ts"

export const Route = createFileRoute("/_app/tools/$toolId")({
  loader: ({ params }) => {
    const tool = toolPreviews.find((item) => item.id === params.toolId)
    if (!tool) throw notFound()
    return {
      toolId: tool.id,
      page: {
        title: tool.label,
        breadcrumb: tool.label,
        description: tool.description,
        section: "Tools",
      },
    }
  },
  component: ToolPage,
})

function ToolPage() {
  const { toolId } = Route.useLoaderData()
  const tool = toolPreviews.find((item) => item.id === toolId)!
  return <ToolPreview tool={tool} />
}
