import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@acme/ui/components/breadcrumb"
import { SidebarTrigger } from "@acme/ui/components/sidebar"
import { Link, useMatches, useMatchRoute } from "@tanstack/react-router"
import { CodeXmlIcon } from "lucide-react"
import { Fragment } from "react"

import { pageMetadataForMatch } from "@/route-metadata"

export function SiteHeader() {
  const breadcrumbs = useMatches({
    select: (matches) =>
      matches.flatMap((match) => {
        const page = pageMetadataForMatch(match)

        return page ? [{ id: match.id, to: match.pathname, ...page }] : []
      }),
  })
  const matchRoute = useMatchRoute()
  const isApiReference = Boolean(matchRoute({ to: "/develop/api" }))

  return (
    <header className="flex h-(--header-height) shrink-0 items-center border-b bg-background">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Breadcrumb className="min-w-0">
          <BreadcrumbList className="flex-nowrap">
            {breadcrumbs.map((breadcrumb, index) => {
              const isCurrent = index === breadcrumbs.length - 1

              return (
                <Fragment key={breadcrumb.id}>
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
                    {isCurrent ? (
                      <BreadcrumbPage>{breadcrumb.breadcrumb}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link to={breadcrumb.to} />}>
                        {breadcrumb.breadcrumb}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                </Fragment>
              )
            })}
          </BreadcrumbList>
        </Breadcrumb>
        {isApiReference ? (
          <a
            href="/api/openapi"
            className="ml-auto inline-flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium hover:bg-muted"
          >
            <CodeXmlIcon className="size-3.5" />
            <span className="hidden sm:inline">OpenAPI JSON</span>
          </a>
        ) : (
          <Link
            to="/develop/api"
            className="ml-auto inline-flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium hover:bg-muted"
          >
            <CodeXmlIcon className="size-3.5" />
            <span className="hidden sm:inline">API reference</span>
          </Link>
        )}
      </div>
    </header>
  )
}
