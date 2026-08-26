import { Link, createFileRoute } from "@tanstack/react-router"

import { documentHead } from "@/route-metadata"
import type { PageMetadata } from "@/route-metadata"
import { getComponent } from "@/ui/develop/design-system/component-metadata"
import { ComponentPage } from "@/ui/develop/design-system/component-page"

const missingComponentPage = componentPage(undefined)

export const Route = createFileRoute(
  "/_app/develop/design-system/components/$componentId"
)({
  loader: ({ params }) => {
    const component = getComponent(params.componentId)

    return { component, page: componentPage(component) }
  },
  head: ({ loaderData }) =>
    documentHead(loaderData?.page ?? missingComponentPage),
  component: ComponentRoute,
})

function ComponentRoute() {
  const { component } = Route.useLoaderData()

  if (!component) {
    return (
      <div className="mx-auto w-full max-w-5xl px-5 py-14 lg:px-12">
        <p className="text-xs font-medium text-muted-foreground">Component</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Component not found
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          This component is not part of the current public design-system
          surface.
        </p>
        <Link
          to="/develop/design-system"
          className="mt-6 inline-flex text-xs font-medium hover:underline"
        >
          Return to the design system
        </Link>
      </div>
    )
  }

  return <ComponentPage slug={component.slug} />
}

function componentPage(
  component: ReturnType<typeof getComponent>
): PageMetadata {
  return {
    breadcrumb: component?.name ?? "Component",
    description:
      component?.description ??
      "Browse the current public design-system component surface.",
    section: "Design system",
    title: component?.name ?? "Component",
  }
}
