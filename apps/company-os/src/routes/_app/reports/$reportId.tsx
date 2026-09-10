import { createFileRoute, notFound } from "@tanstack/react-router"

import { ReportPreview } from "#/app/customization/workspace-pages.tsx"
import { reportPreviews } from "#/app/customization/workspace.ts"

export const Route = createFileRoute("/_app/reports/$reportId")({
  loader: ({ params }) => {
    const report = reportPreviews.find((item) => item.id === params.reportId)
    if (!report) throw notFound()
    return {
      reportId: report.id,
      page: {
        title: report.label,
        breadcrumb: report.label,
        description: report.description,
        section: "Reports",
      },
    }
  },
  component: ReportPage,
})

function ReportPage() {
  const { reportId } = Route.useLoaderData()
  const report = reportPreviews.find((item) => item.id === reportId)!
  return <ReportPreview report={report} />
}
