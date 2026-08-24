import { createFileRoute } from "@tanstack/react-router"

import { pageOptions } from "@/route-metadata"

const page = {
  breadcrumb: "API reference",
  description:
    "Explore the OpenAPI contract generated from the source-owned domain model.",
  title: "API reference",
}

export const Route = createFileRoute("/_app/develop/api")({
  ...pageOptions(page),
  component: ApiReferencePage,
})

function ApiReferencePage() {
  return (
    <div className="flex min-h-0 flex-1 bg-background">
      {/* oxlint-disable-next-line react/iframe-missing-sandbox -- Scalar is trusted, same-origin application content. */}
      <iframe
        className="h-[calc(100svh-var(--header-height))] w-full border-0 bg-background"
        src="/api/docs"
        title="API reference"
      />
    </div>
  )
}
